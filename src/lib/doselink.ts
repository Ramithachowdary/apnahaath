import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";
import { getDoseSlot, getMedicine, getMembership, getUser, insertEvent, query, updateDoseSlotStatus } from "./db";
import type { Role } from "./types";

/**
 * One-tap "I took it" links for reminder emails.
 * - HMAC-SHA256 signed (key derived from SESSION_SECRET), expires (default 6 h), single use.
 * - Bound to one recipient (uid), one household and one dose slot.
 * - Counts as the elder's own confirmation ONLY when the link was issued to the elder.
 *   Any other member's link is recorded as a witness and never marks the dose taken.
 */
export interface DoseLinkPayload {
  v: 1;
  hid: string;
  sid: string;
  uid: string;
  role: Role;
  exp: number; // unix seconds
  n: string; // nonce
}

/** One-tap email dose links expire after 6 hours. */
export const DOSE_LINK_TTL_S = 6 * 60 * 60;

function key(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return `doselink:${s}`;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is required");
  return "doselink:apnahaath-local-dev-secret";
}
const sign = (p: string) => createHmac("sha256", key()).update(p).digest("base64url");

/** Create a signed, expiring, single-use token for a one-tap dose link in an email. */
export function createDoseToken(
  p: Omit<DoseLinkPayload, "v" | "exp" | "n">,
  ttlS = DOSE_LINK_TTL_S,
  nowS = Date.now() / 1000,
): string {
  const payload: DoseLinkPayload = { v: 1, ...p, exp: Math.floor(nowS + ttlS), n: randomUUID() };
  const b = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${b}.${sign(b)}`;
}

/** Verify a dose-link token signature and expiry (does not redeem it). */
export function verifyDoseToken(
  token: string,
  nowS = Date.now() / 1000,
): { ok: true; payload: DoseLinkPayload } | { ok: false; reason: string } {
  const parts = (token || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1] || token.length > 1200)
    return { ok: false, reason: "This link is not valid." };
  const a = Buffer.from(parts[1]);
  const b = Buffer.from(sign(parts[0]));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "This link is not valid." };
  try {
    const p = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as DoseLinkPayload;
    if (p.v !== 1 || typeof p.exp !== "number") return { ok: false, reason: "This link is not valid." };
    if (nowS > p.exp) return { ok: false, reason: "This link has expired. Please open the app instead." };
    return { ok: true, payload: p };
  } catch {
    return { ok: false, reason: "This link is not valid." };
  }
}

/** Outcome of redeeming a one-tap dose link. */
export type RedeemResult =
  | { ok: true; outcome: "elder_confirmed" | "witnessed"; medicine: string }
  | { ok: false; status: number; reason: string };

/** Verifies, claims (single use) and records the dose-link action. */
export async function redeemDoseToken(token: string, nowS = Date.now() / 1000): Promise<RedeemResult> {
  const v = verifyDoseToken(token, nowS);
  if (!v.ok) return { ok: false, status: 400, reason: v.reason };
  const p = v.payload;
  const membership = await getMembership(p.uid, p.hid);
  // The role is re-checked from the database: a link stops working if the member's role changed.
  if (!membership || membership.role !== p.role)
    return { ok: false, status: 403, reason: "This link is no longer valid for this care circle." };
  const slot = await getDoseSlot(p.hid, p.sid);
  if (!slot) return { ok: false, status: 404, reason: "This dose was not found." };
  if (p.role === "elder" && slot.status === "skipped")
    return { ok: false, status: 409, reason: "This dose was already marked as skipped." };
  if (p.role === "elder" && slot.status === "elder_confirmed")
    return { ok: false, status: 409, reason: "This dose was already marked as taken." };
  const jti = createHash("sha256").update(token).digest("hex");
  const claimed = await query(`INSERT INTO auth_meta (key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING`, [
    `doselink:${jti}`,
    String(Math.floor(nowS)),
  ]);
  if (claimed.rowCount === 0) return { ok: false, status: 409, reason: "This link was already used." };
  const user = await getUser(p.uid);
  const medicine = (await getMedicine(p.hid, slot.medicine_id))?.name ?? "medicine";
  const name = user?.name ?? "Member";
  if (p.role === "elder") {
    await updateDoseSlotStatus(p.hid, slot.id, "elder_confirmed", null);
    await insertEvent(p.hid, {
      id: `evt-${randomUUID()}`,
      type: "elder_confirmed",
      actor_role: "elder",
      actor_name: name,
      medicine_id: slot.medicine_id,
      dose_slot_id: slot.id,
      payload: { via: "email_link" },
    });
    return { ok: true, outcome: "elder_confirmed", medicine };
  }
  await insertEvent(p.hid, {
    id: `evt-${randomUUID()}`,
    type: "witnessed",
    actor_role: p.role,
    actor_name: name,
    medicine_id: slot.medicine_id,
    dose_slot_id: slot.id,
    payload: { via: "email_link", note: "Witness only, not counted as taken" },
  });
  return { ok: true, outcome: "witnessed", medicine };
}
