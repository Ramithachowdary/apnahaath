/**
 * Database driver: Postgres via DATABASE_URL, either Neon (serverless HTTP driver) or any other
 * Postgres such as Supabase (node-postgres pool; use the pooler URL on Vercel).
 * Without DATABASE_URL (local dev, tests): PGlite, an in-process WASM Postgres (no native modules, offline).
 * No in-memory state is relied on across requests: lockouts and rate limits live in the database.
 * Timestamps are stored as ISO-8601 text with explicit +05:30 offset (IST wall clock), sortable as text.
 */
import { SCHEMA } from "./schema";

/** A bound SQL parameter. */
export type Arg = string | number | null;
/** One parameterised statement, used for atomic multi-statement writes. */
export type Stmt = { sql: string; args: Arg[] };
type QueryResult = { rows: Record<string, unknown>[]; rowCount: number };
interface Driver {
  query(sql: string, args: Arg[]): Promise<QueryResult>;
  exec(sql: string): Promise<void>;
  batch(stmts: Stmt[]): Promise<void>;
}

/** Small pool: serverless functions run many short-lived instances. */
const PG_POOL = { max: 3, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 8_000 } as const;

/** Convert `?` placeholders to Postgres `$1..$n`. (No literal `?` is used inside our SQL.) */
function pg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/** Split a multi-statement script (the schema) into single statements, dropping `--` comments. */
export function splitStatements(script: string): string[] {
  return script
    .split(";")
    .map((x) => x.replace(/--.*$/gm, "").trim())
    .filter(Boolean);
}

const g = globalThis as unknown as { __ahDriver?: Promise<Driver>; __ahSchema?: Promise<void> };

/** Any standard Postgres (Supabase, RDS, local) through node-postgres, pure JS. */
async function nodePostgresDriver(url: string): Promise<Driver> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: url,
    ...PG_POOL,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
  });
  return {
    async query(text, args) {
      const r = await pool.query(pg(text), args);
      return { rows: r.rows, rowCount: r.rowCount ?? 0 };
    },
    async exec(text) {
      await pool.query(text);
    },
    async batch(stmts) {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        for (const st of stmts) await c.query(pg(st.sql), st.args);
        await c.query("COMMIT");
      } catch (e) {
        await c.query("ROLLBACK").catch(() => undefined);
        throw e;
      } finally {
        c.release();
      }
    },
  };
}

/** Neon over HTTP: a multi-statement script or batch is sent as one transaction in one round trip. */
async function neonDriver(url: string): Promise<Driver> {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url, { fullResults: true });
  return {
    async query(text, args) {
      const r = await sql.query(pg(text), args);
      return { rows: r.rows as Record<string, unknown>[], rowCount: r.rowCount ?? 0 };
    },
    async exec(text) {
      await sql.transaction(splitStatements(text).map((stmt) => sql.query(stmt)));
    },
    async batch(stmts) {
      if (!stmts.length) return;
      await sql.transaction(stmts.map((st) => sql.query(pg(st.sql), st.args)));
    },
  };
}

/** PGlite: in-process WASM Postgres for local development and tests. */
async function pgliteDriver(): Promise<Driver> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pglite = new PGlite(process.env.PGLITE_DATA_DIR || undefined);
  return {
    async query(text, args) {
      const r = await pglite.query(pg(text), args);
      return { rows: r.rows as Record<string, unknown>[], rowCount: r.affectedRows ?? 0 };
    },
    async exec(text) {
      await pglite.exec(text);
    },
    async batch(stmts) {
      await pglite.transaction(async (tx) => {
        for (const st of stmts) await tx.query(pg(st.sql), st.args);
      });
    },
  };
}

function makeDriver(): Promise<Driver> {
  const url = process.env.DATABASE_URL;
  if (!url) return pgliteDriver();
  return /neon\.tech/.test(url) ? neonDriver(url) : nodePostgresDriver(url);
}

/** Driver + idempotent migrations (CREATE TABLE IF NOT EXISTS), run once per server instance. */
async function db(): Promise<Driver> {
  if (!g.__ahDriver) g.__ahDriver = makeDriver();
  const d = await g.__ahDriver;
  if (!g.__ahSchema) {
    g.__ahSchema = d.exec(SCHEMA).catch((e) => {
      g.__ahSchema = undefined;
      throw e;
    });
  }
  await g.__ahSchema;
  return d;
}

/** Run one parameterised statement (`?` placeholders). */
export async function query(sql: string, args: Arg[] = []): Promise<QueryResult> {
  return (await db()).query(sql, args);
}
/** All rows of a SELECT. */
export async function all<T>(sql: string, args: Arg[] = []): Promise<T[]> {
  return (await query(sql, args)).rows as T[];
}
/** First row of a SELECT, if any. */
export async function one<T>(sql: string, args: Arg[] = []): Promise<T | undefined> {
  return (await all<T>(sql, args))[0];
}
/** Execute a write and return the number of affected rows. */
export async function run(sql: string, args: Arg[] = []): Promise<number> {
  return (await query(sql, args)).rowCount;
}
/** Run several statements atomically in one transaction. */
export async function batch(stmts: Stmt[]): Promise<void> {
  await (await db()).batch(stmts);
}
