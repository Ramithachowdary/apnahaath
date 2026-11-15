import { NextResponse } from "next/server";
import { withSession } from "@/lib/auth";
import { getAuthMeta, setAuthMeta } from "@/lib/db";
import { createDemoHousehold } from "@/lib/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PER_WINDOW = 40;
const WINDOW_MS = 10 * 60_000;

/** Creates a fresh, isolated demo care circle and signs in as the family member (Priya). Rate-limited in the DB. */
export async function POST() {
  const now = Date.now();
  const raw = await getAuthMeta("demo_rate");
  let [start, count] = raw ? raw.split(":").map(Number) : [now, 0];
  if (now - start > WINDOW_MS) { start = now; count = 0; }
  if (count >= MAX_PER_WINDOW) return NextResponse.json({ error: "Too many demo households right now. Try again in a few minutes." }, { status: 429 });
  await setAuthMeta("demo_rate", `${start}:${count + 1}`);
  const demo = await createDemoHousehold();
  return withSession(NextResponse.json({ ok: true, householdId: demo.householdId, credentials: demo.credentials }), demo.userIds.family, demo.householdId);
}
