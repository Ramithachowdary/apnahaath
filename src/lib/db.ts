import type {
  AdherenceStats,
  Appointment,
  CareEvent,
  DecisionCard,
  DoseSlot,
  Household,
  Medicine,
  Member,
  Membership,
  Proposal,
  ReminderOutbox,
  Role,
  User,
} from "./types";
import { MISS_GRACE_MINUTES } from "./constants";
import { formatIstIso, istDateTimeOnToday, minutesSince, todayIstDateString } from "./time";

/**
 * Database: Postgres via DATABASE_URL — Neon (serverless HTTP driver) or any other Postgres such as
 * Supabase (node-postgres pool; use the pooler URL on Vercel).
 * Without DATABASE_URL (local dev, tests): PGlite, an in-process WASM Postgres (no native modules, offline).
 * No in-memory state is relied on across requests: lockouts and rate limits live in the database.
 * Timestamps are stored as ISO-8601 text with explicit +05:30 offset (IST wall clock), sortable as text.
 */
export type Arg = string | number | null;
export type Stmt = { sql: string; args: Arg[] };
interface Driver {
  query(sql: string, args: Arg[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
  exec(sql: string): Promise<void>;
  batch(stmts: Stmt[]): Promise<void>;
}

/** Convert `?` placeholders to Postgres `$1..$n`. (No literal `?` is used inside our SQL.) */
function pg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY, elder_name TEXT NOT NULL, elder_age INTEGER, city TEXT NOT NULL,
  language TEXT NOT NULL, owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_demo INTEGER NOT NULL DEFAULT 0, demo_credentials_json TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('elder','caretaker','family')),
  pin_hash TEXT NOT NULL, failed_attempts INTEGER NOT NULL DEFAULT 0, lockout_until TEXT,
  created_at TEXT NOT NULL, UNIQUE (user_id, household_id)
);
CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('elder','caretaker','family')), code_hash TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL,
  used_by TEXT REFERENCES users(id) ON DELETE SET NULL, used_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS medicines (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL, brand_hi TEXT NOT NULL, dose TEXT NOT NULL, schedule_time TEXT NOT NULL,
  instructions TEXT NOT NULL, color_band TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, notes TEXT
);
CREATE TABLE IF NOT EXISTS dose_slots (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  medicine_id TEXT NOT NULL REFERENCES medicines(id) ON DELETE CASCADE, scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','elder_confirmed','skipped','missed')), skip_reason TEXT
);
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  doctor TEXT NOT NULL, place TEXT NOT NULL, scheduled_at TEXT NOT NULL, notes TEXT
);
-- Append-only authorship log: the app only ever INSERTs into care_events.
CREATE TABLE IF NOT EXISTS care_events (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  type TEXT NOT NULL, actor_role TEXT NOT NULL, actor_name TEXT NOT NULL, medicine_id TEXT,
  dose_slot_id TEXT, appointment_id TEXT, payload_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS decision_cards (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  source_event_id TEXT, severity TEXT NOT NULL, title TEXT NOT NULL, elder_line_hi TEXT NOT NULL,
  caretaker_line_hi TEXT NOT NULL, family_line_en TEXT NOT NULL, tell_doctor TEXT NOT NULL,
  disclaimer TEXT NOT NULL, emergency_line TEXT NOT NULL, cached INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reminder_outbox (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, to_email TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE, status TEXT NOT NULL, created_at TEXT NOT NULL, sent_at TEXT, error TEXT
);
CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, medicine_id TEXT, payload_json TEXT NOT NULL, status TEXT NOT NULL,
  created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_household ON memberships(household_id);
CREATE INDEX IF NOT EXISTS idx_events_household ON care_events(household_id, created_at);
CREATE INDEX IF NOT EXISTS idx_slots_household ON dose_slots(household_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meds_household ON medicines(household_id);
CREATE INDEX IF NOT EXISTS idx_outbox_household ON reminder_outbox(household_id);
`;

const g = globalThis as unknown as { __ahDriver?: Promise<Driver>; __ahSchema?: Promise<void> };

async function makeDriver(): Promise<Driver> {
  const url = process.env.DATABASE_URL;
  if (url && !/neon\.tech/.test(url)) {
    // Any standard Postgres (Supabase, RDS, local): node-postgres, pure JS. Small pool for serverless.
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
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
  if (url) {
    // Neon: serverless HTTP driver
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url, { fullResults: true });
    return {
      async query(text, args) {
        const r = await sql.query(pg(text), args);
        return { rows: r.rows as Record<string, unknown>[], rowCount: r.rowCount ?? 0 };
      },
      async exec(text) {
        for (const stmt of text.split(";").map((x) => x.replace(/--.*$/gm, "").trim()).filter(Boolean)) {
          await sql.query(stmt);
        }
      },
      async batch(stmts) {
        if (!stmts.length) return;
        await sql.transaction(stmts.map((st) => sql.query(pg(st.sql), st.args)));
      },
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite(process.env.PGLITE_DATA_DIR || undefined);
  return {
    async query(text, args) {
      const r = await db.query(pg(text), args);
      return { rows: r.rows as Record<string, unknown>[], rowCount: r.affectedRows ?? 0 };
    },
    async exec(text) {
      await db.exec(text);
    },
    async batch(stmts) {
      await db.transaction(async (tx) => {
        for (const st of stmts) await tx.query(pg(st.sql), st.args);
      });
    },
  };
}

/** Driver + idempotent migrations (CREATE TABLE IF NOT EXISTS) on first use per instance. */
export async function db(): Promise<Driver> {
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

export async function query(sql: string, args: Arg[] = []) {
  return (await db()).query(sql, args);
}
async function all<T>(sql: string, args: Arg[] = []): Promise<T[]> {
  return (await query(sql, args)).rows as T[];
}
async function one<T>(sql: string, args: Arg[] = []): Promise<T | undefined> {
  return (await all<T>(sql, args))[0];
}
async function run(sql: string, args: Arg[] = []): Promise<number> {
  return (await query(sql, args)).rowCount;
}
export async function batch(stmts: Stmt[]): Promise<void> {
  await (await db()).batch(stmts);
}

/** Admin-only: wipe all data (schema stays). */
export async function resetDatabase(): Promise<void> {
  await (await db()).exec(
    "TRUNCATE users, households, memberships, invites, medicines, dose_slots, appointments, care_events, decision_cards, reminder_outbox, proposals, auth_meta CASCADE",
  );
}

// ---------- users / households / memberships ----------
export async function createUser(u: Omit<User, "created_at">) {
  await run(`INSERT INTO users (id,name,email,password_hash,is_demo,created_at) VALUES (?,?,?,?,?,?)`,
    [u.id, u.name, u.email.toLowerCase(), u.password_hash, u.is_demo, formatIstIso()]);
}
export const createUserStmt = (u: Omit<User, "created_at">): Stmt => ({
  sql: `INSERT INTO users (id,name,email,password_hash,is_demo,created_at) VALUES (?,?,?,?,?,?)`,
  args: [u.id, u.name, u.email.toLowerCase(), u.password_hash, u.is_demo, formatIstIso()],
});
export async function getUserByEmail(email: string) {
  return one<User>(`SELECT * FROM users WHERE email = ?`, [email.toLowerCase()]);
}
export async function getUser(id: string) {
  return one<User>(`SELECT * FROM users WHERE id = ?`, [id]);
}
export const createHouseholdStmt = (h: Omit<Household, "created_at">): Stmt => ({
  sql: `INSERT INTO households (id,elder_name,elder_age,city,language,owner_user_id,is_demo,demo_credentials_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
  args: [h.id, h.elder_name, h.elder_age, h.city, h.language, h.owner_user_id, h.is_demo, h.demo_credentials_json, formatIstIso()],
});
export async function getHousehold(id: string) {
  return one<Household>(`SELECT * FROM households WHERE id = ?`, [id]);
}
export const addMembershipStmt = (m: { id: string; user_id: string; household_id: string; role: Role; pin_hash: string }): Stmt => ({
  sql: `INSERT INTO memberships (id,user_id,household_id,role,pin_hash,created_at) VALUES (?,?,?,?,?,?)`,
  args: [m.id, m.user_id, m.household_id, m.role, m.pin_hash, formatIstIso()],
});
export async function getMembership(userId: string, householdId: string) {
  return one<Membership>(`SELECT * FROM memberships WHERE user_id = ? AND household_id = ?`, [userId, householdId]);
}
export async function getMembershipById(id: string) {
  return one<Membership>(`SELECT * FROM memberships WHERE id = ?`, [id]);
}
export async function listUserHouseholds(userId: string) {
  return all<{ id: string; elder_name: string; city: string; is_demo: number; role: Role }>(
    `SELECT h.id, h.elder_name, h.city, h.is_demo, m.role FROM memberships m JOIN households h ON h.id = m.household_id
     WHERE m.user_id = ? ORDER BY h.created_at DESC`, [userId]);
}
export async function listMembers(hh: string) {
  return all<Member & { is_demo: number }>(
    `SELECT u.id, u.name, u.email, u.is_demo, m.role FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE m.household_id = ? ORDER BY m.created_at`, [hh]);
}
export async function householdHasRole(hh: string, role: Role) {
  return Boolean(await one(`SELECT 1 AS x FROM memberships WHERE household_id = ? AND role = ?`, [hh, role]));
}
export async function setMembershipLock(id: string, failed: number, until: string | null) {
  await run(`UPDATE memberships SET failed_attempts = ?, lockout_until = ? WHERE id = ?`, [failed, until, id]);
}

// ---------- invites ----------
export async function insertInvite(i: { id: string; household_id: string; role: Role; code_hash: string; created_by: string; expires_at: string }) {
  await run(`INSERT INTO invites (id,household_id,role,code_hash,created_by,expires_at,created_at) VALUES (?,?,?,?,?,?,?)`,
    [i.id, i.household_id, i.role, i.code_hash, i.created_by, i.expires_at, formatIstIso()]);
}
export async function getInviteByHash(hash: string) {
  return one<{ id: string; household_id: string; role: Role; expires_at: string; used_by: string | null }>(
    `SELECT * FROM invites WHERE code_hash = ?`, [hash]);
}
/** Atomically mark used; false if already used. */
export async function consumeInvite(id: string, userId: string) {
  return (await run(`UPDATE invites SET used_by = ?, used_at = ? WHERE id = ? AND used_by IS NULL`, [userId, formatIstIso(), id])) === 1;
}
export async function listInvites(hh: string) {
  return all<{ id: string; role: Role; expires_at: string; used_by: string | null; created_at: string }>(
    `SELECT id, role, expires_at, used_by, created_at FROM invites WHERE household_id = ? ORDER BY created_at DESC LIMIT 20`, [hh]);
}

// ---------- medicines / slots ----------
export async function listMedicines(hh: string, activeOnly = false) {
  return all<Medicine>(`SELECT * FROM medicines WHERE household_id = ? ${activeOnly ? "AND active = 1" : ""} ORDER BY schedule_time`, [hh]);
}
export async function getMedicine(hh: string, id: string) {
  return one<Medicine>(`SELECT * FROM medicines WHERE id = ? AND household_id = ?`, [id, hh]);
}
export const insertMedicineStmt = (m: Medicine): Stmt => ({
  sql: `INSERT INTO medicines (id,household_id,name,brand_hi,dose,schedule_time,instructions,color_band,active,notes) VALUES (?,?,?,?,?,?,?,?,?,?)`,
  args: [m.id, m.household_id, m.name, m.brand_hi, m.dose, m.schedule_time, m.instructions, m.color_band, m.active, m.notes],
});
export async function insertMedicine(m: Medicine) {
  await batch([insertMedicineStmt(m)]);
}
export async function setMedicineActive(hh: string, id: string, active: number) {
  await run(`UPDATE medicines SET active = ? WHERE id = ? AND household_id = ?`, [active, id, hh]);
  if (!active) await run(`DELETE FROM dose_slots WHERE medicine_id = ? AND household_id = ? AND status = 'pending'`, [id, hh]);
}
export async function updateMedicineSchedule(hh: string, id: string, t: string) {
  await run(`UPDATE medicines SET schedule_time = ? WHERE id = ? AND household_id = ?`, [t, id, hh]);
  await run(`UPDATE dose_slots SET scheduled_at = ? WHERE medicine_id = ? AND household_id = ? AND status = 'pending'`, [istDateTimeOnToday(t), id, hh]);
}
export function slotIdFor(medId: string, day = todayIstDateString()) {
  return `${medId}-${day.replaceAll("-", "")}`;
}
/** Create today's dose slots for active medicines (idempotent). */
export async function ensureTodaySlots(hh: string) {
  const meds = await listMedicines(hh, true);
  if (!meds.length) return;
  await batch(meds.map((m) => ({
    sql: `INSERT INTO dose_slots (id,household_id,medicine_id,scheduled_at,status,skip_reason) VALUES (?,?,?,?, 'pending', NULL) ON CONFLICT (id) DO NOTHING`,
    args: [slotIdFor(m.id), hh, m.id, istDateTimeOnToday(m.schedule_time)],
  })));
}
export type SlotRow = DoseSlot & { medicine_name: string; brand_hi: string; color_band: string; instructions: string };
export async function listDoseSlots(hh: string, day = todayIstDateString()) {
  return all<SlotRow>(
    `SELECT d.*, m.name as medicine_name, m.brand_hi, m.color_band, m.dose as med_dose, m.instructions
     FROM dose_slots d JOIN medicines m ON m.id = d.medicine_id
     WHERE d.household_id = ? AND substr(d.scheduled_at,1,10) = ? ORDER BY d.scheduled_at`, [hh, day]);
}
export async function listRecentSlots(hh: string, sinceDay: string) {
  return all<SlotRow>(
    `SELECT d.*, m.name as medicine_name, m.brand_hi, m.color_band, m.instructions
     FROM dose_slots d JOIN medicines m ON m.id = d.medicine_id
     WHERE d.household_id = ? AND substr(d.scheduled_at,1,10) >= ? ORDER BY d.scheduled_at DESC`, [hh, sinceDay]);
}
export async function getDoseSlot(hh: string, id: string) {
  return one<DoseSlot>(`SELECT * FROM dose_slots WHERE id = ? AND household_id = ?`, [id, hh]);
}
export async function updateDoseSlotStatus(hh: string, id: string, status: DoseSlot["status"], skipReason: string | null = null) {
  await run(`UPDATE dose_slots SET status = ?, skip_reason = ? WHERE id = ? AND household_id = ?`, [status, skipReason, id, hh]);
}

// ---------- events ----------
export type EventInput = {
  id: string; type: string; actor_role: string; actor_name: string;
  medicine_id?: string | null; dose_slot_id?: string | null; appointment_id?: string | null; payload: unknown; created_at?: string;
};
export const insertEventStmt = (hh: string, e: EventInput): Stmt => ({
  sql: `INSERT INTO care_events (id,household_id,type,actor_role,actor_name,medicine_id,dose_slot_id,appointment_id,payload_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
  args: [e.id, hh, e.type, e.actor_role, e.actor_name, e.medicine_id ?? null, e.dose_slot_id ?? null, e.appointment_id ?? null, JSON.stringify(e.payload), e.created_at ?? formatIstIso()],
});
export async function insertEvent(hh: string, e: EventInput) {
  await batch([insertEventStmt(hh, e)]);
}
export async function listEvents(hh: string, limit = 50) {
  return all<CareEvent>(`SELECT * FROM care_events WHERE household_id = ? ORDER BY created_at DESC LIMIT ?`, [hh, limit]);
}

// ---------- appointments ----------
export async function listAppointments(hh: string) {
  return all<Appointment>(`SELECT * FROM appointments WHERE household_id = ? ORDER BY scheduled_at`, [hh]);
}
export async function getAppointment(hh: string, id: string) {
  return one<Appointment>(`SELECT * FROM appointments WHERE id = ? AND household_id = ?`, [id, hh]);
}
export const upsertAppointmentStmt = (a: Appointment): Stmt => ({
  sql: `INSERT INTO appointments (id,household_id,doctor,place,scheduled_at,notes) VALUES (?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET doctor=excluded.doctor, place=excluded.place, scheduled_at=excluded.scheduled_at, notes=excluded.notes
        WHERE appointments.household_id = excluded.household_id`,
  args: [a.id, a.household_id, a.doctor, a.place, a.scheduled_at, a.notes],
});
export async function upsertAppointment(a: Appointment) {
  await batch([upsertAppointmentStmt(a)]);
}

// ---------- cards ----------
export async function listDecisionCards(hh: string) {
  return all<DecisionCard>(`SELECT * FROM decision_cards WHERE household_id = ? ORDER BY created_at DESC`, [hh]);
}
export async function getDecisionCard(hh: string, id: string) {
  return one<DecisionCard>(`SELECT * FROM decision_cards WHERE id = ? AND household_id = ?`, [id, hh]);
}
export const insertDecisionCardStmt = (c: DecisionCard): Stmt => ({
  sql: `INSERT INTO decision_cards (id,household_id,source_event_id,severity,title,elder_line_hi,caretaker_line_hi,family_line_en,tell_doctor,disclaimer,emergency_line,cached,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  args: [c.id, c.household_id, c.source_event_id, c.severity, c.title, c.elder_line_hi, c.caretaker_line_hi, c.family_line_en, c.tell_doctor, c.disclaimer, c.emergency_line, c.cached, c.created_at],
});
export async function insertDecisionCard(c: DecisionCard) {
  await batch([insertDecisionCardStmt(c)]);
}

// ---------- outbox ----------
export async function listOutbox(hh: string) {
  return all<ReminderOutbox>(`SELECT * FROM reminder_outbox WHERE household_id = ? ORDER BY created_at DESC`, [hh]);
}
/** Returns false when the idempotency key already exists (no duplicate email). */
export async function insertOutbox(r: ReminderOutbox): Promise<boolean> {
  const n = await run(
    `INSERT INTO reminder_outbox (id,household_id,kind,to_email,subject,body,idempotency_key,status,created_at,sent_at,error) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`,
    [r.id, r.household_id, r.kind, r.to_email, r.subject, r.body, r.idempotency_key, r.status, r.created_at, r.sent_at, r.error]);
  return n === 1;
}
export async function updateOutboxStatus(id: string, status: ReminderOutbox["status"], error: string | null = null) {
  await run(`UPDATE reminder_outbox SET status = ?, sent_at = ?, error = ? WHERE id = ?`,
    [status, status === "sent" || status === "mock" ? formatIstIso() : null, error, id]);
}

// ---------- adherence ----------
export async function getAdherenceStats(hh: string): Promise<AdherenceStats> {
  let elderConfirmed = 0, skipped = 0, missed = 0, pending = 0, dueOrPast = 0;
  for (const s of await listDoseSlots(hh)) {
    const age = minutesSince(s.scheduled_at);
    if (age >= 0) dueOrPast += 1;
    if (s.status === "elder_confirmed") elderConfirmed += 1;
    else if (s.status === "skipped") skipped += 1;
    else if (s.status === "missed") missed += 1;
    else if (age > MISS_GRACE_MINUTES) missed += 1;
    else pending += 1;
  }
  const w = await one<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM care_events WHERE household_id = ? AND type = 'witnessed' AND substr(created_at,1,10) = ?`, [hh, todayIstDateString()]);
  // Skips are an elder decision, not a failure: excluded from the denominator.
  const denom = elderConfirmed + missed;
  const elderConfirmationRate = denom === 0 ? null : Math.round((elderConfirmed / denom) * 1000) / 10;
  return { elderConfirmed, witnessed: Number(w?.c ?? 0), skipped, missed, pending, dueOrPast, elderConfirmationRate };
}

// ---------- proposals ----------
export async function listProposals(hh: string) {
  return all<Proposal>(`SELECT * FROM proposals WHERE household_id = ? ORDER BY created_at DESC`, [hh]);
}
export async function insertProposal(hh: string, p: { id: string; kind: string; medicine_id: string | null; payload: unknown; created_by: string }) {
  await run(`INSERT INTO proposals (id,household_id,kind,medicine_id,payload_json,status,created_by,created_at) VALUES (?,?,?,?,?, 'pending', ?, ?)`,
    [p.id, hh, p.kind, p.medicine_id, JSON.stringify(p.payload), p.created_by, formatIstIso()]);
}
export async function updateProposalStatus(hh: string, id: string, status: string) {
  await run(`UPDATE proposals SET status = ? WHERE id = ? AND household_id = ?`, [status, id, hh]);
}
export async function getProposal(hh: string, id: string) {
  return one<Proposal>(`SELECT * FROM proposals WHERE id = ? AND household_id = ?`, [id, hh]);
}

// ---------- meta (lockouts, rate limits) ----------
export async function getAuthMeta(key: string): Promise<string> {
  return (await one<{ value: string }>(`SELECT value FROM auth_meta WHERE key = ?`, [key]))?.value ?? "";
}
export async function setAuthMeta(key: string, value: string) {
  await run(`INSERT INTO auth_meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [key, value]);
}
