/** Care circles (households), memberships and invites. */
import type { Household, Member, Membership, Role } from "../types";
import { formatIstIso } from "../time";
import { all, one, run, type Stmt } from "./driver";

/** Create household (batch statement). */
export const createHouseholdStmt = (h: Omit<Household, "created_at">): Stmt => ({
  sql: `INSERT INTO households (id,elder_name,elder_age,city,language,owner_user_id,is_demo,demo_credentials_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
  args: [
    h.id,
    h.elder_name,
    h.elder_age,
    h.city,
    h.language,
    h.owner_user_id,
    h.is_demo,
    h.demo_credentials_json,
    formatIstIso(),
  ],
});
/** Get household. */
export async function getHousehold(id: string) {
  return one<Household>(`SELECT * FROM households WHERE id = ?`, [id]);
}
/** Add membership (batch statement). */
export const addMembershipStmt = (m: {
  id: string;
  user_id: string;
  household_id: string;
  role: Role;
  pin_hash: string;
}): Stmt => ({
  sql: `INSERT INTO memberships (id,user_id,household_id,role,pin_hash,created_at) VALUES (?,?,?,?,?,?)`,
  args: [m.id, m.user_id, m.household_id, m.role, m.pin_hash, formatIstIso()],
});
/** Get membership. */
export async function getMembership(userId: string, householdId: string) {
  return one<Membership>(`SELECT * FROM memberships WHERE user_id = ? AND household_id = ?`, [userId, householdId]);
}
/** Get membership by id. */
export async function getMembershipById(id: string) {
  return one<Membership>(`SELECT * FROM memberships WHERE id = ?`, [id]);
}
/** List user households. */
export async function listUserHouseholds(userId: string) {
  return all<{ id: string; elder_name: string; city: string; is_demo: number; role: Role }>(
    `SELECT h.id, h.elder_name, h.city, h.is_demo, m.role FROM memberships m JOIN households h ON h.id = m.household_id
     WHERE m.user_id = ? ORDER BY h.created_at DESC`,
    [userId],
  );
}
/** List members, scoped to one household. */
export async function listMembers(hh: string) {
  return all<Member & { is_demo: number }>(
    `SELECT u.id, u.name, u.email, u.is_demo, m.role FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE m.household_id = ? ORDER BY m.created_at`,
    [hh],
  );
}
/** Household has role, scoped to one household. */
export async function householdHasRole(hh: string, role: Role) {
  return Boolean(await one(`SELECT 1 AS x FROM memberships WHERE household_id = ? AND role = ?`, [hh, role]));
}
/** Set membership lock. */
export async function setMembershipLock(id: string, failed: number, until: string | null) {
  await run(`UPDATE memberships SET failed_attempts = ?, lockout_until = ? WHERE id = ?`, [failed, until, id]);
}

// ---------- invites ----------
export async function insertInvite(i: {
  id: string;
  household_id: string;
  role: Role;
  code_hash: string;
  created_by: string;
  expires_at: string;
}) {
  await run(
    `INSERT INTO invites (id,household_id,role,code_hash,created_by,expires_at,created_at) VALUES (?,?,?,?,?,?,?)`,
    [i.id, i.household_id, i.role, i.code_hash, i.created_by, i.expires_at, formatIstIso()],
  );
}
/** Get invite by hash. */
export async function getInviteByHash(hash: string) {
  return one<{ id: string; household_id: string; role: Role; expires_at: string; used_by: string | null }>(
    `SELECT * FROM invites WHERE code_hash = ?`,
    [hash],
  );
}
/** Atomically mark used; false if already used. */
export async function consumeInvite(id: string, userId: string) {
  return (
    (await run(`UPDATE invites SET used_by = ?, used_at = ? WHERE id = ? AND used_by IS NULL`, [
      userId,
      formatIstIso(),
      id,
    ])) === 1
  );
}
/** List invites, scoped to one household. */
export async function listInvites(hh: string) {
  return all<{ id: string; role: Role; expires_at: string; used_by: string | null; created_at: string }>(
    `SELECT id, role, expires_at, used_by, created_at FROM invites WHERE household_id = ? ORDER BY created_at DESC LIMIT 20`,
    [hh],
  );
}
