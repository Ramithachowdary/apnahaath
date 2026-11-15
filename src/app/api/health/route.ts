import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await query("SELECT 1");
    return NextResponse.json({
      ok: true,
      service: "apnahaath",
      db: process.env.DATABASE_URL ? "neon-postgres" : "pglite-local",
      time: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[health] database check failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, service: "apnahaath", error: "Database unavailable" }, { status: 503 });
  }
}
