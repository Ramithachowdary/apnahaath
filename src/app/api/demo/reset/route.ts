import { NextResponse } from "next/server";
import { z } from "zod";
import { getResetAdminCode, RESET_RATE_LIMIT_MS } from "@/lib/constants";
import { getAuthMeta, resetDatabase, setAuthMeta } from "@/lib/db";
import { parseBody, passcode } from "@/lib/validate";
import { timingSafeEqual } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin-only wipe of the database. Needs RESET_ADMIN_CODE (env, never shown). Rate-limited (stored in DB). */
export async function POST(req: Request) {
  const p = await parseBody(req, z.object({ passcode }));
  if ("error" in p) return p.error;
  const last = await getAuthMeta("last_reset_attempt");
  if (last && Date.now() - Number(last) < RESET_RATE_LIMIT_MS) {
    return NextResponse.json({ error: "Reset is rate-limited. Wait a minute." }, { status: 429 });
  }
  await setAuthMeta("last_reset_attempt", String(Date.now()));
  const a = Buffer.from(p.data.passcode);
  const b = Buffer.from(getResetAdminCode());
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Invalid admin code" }, { status: 401 });
  await resetDatabase();
  await setAuthMeta("last_reset_attempt", String(Date.now()));
  return NextResponse.json({ ok: true, message: "Database wiped" });
}
