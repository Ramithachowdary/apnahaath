/** AI decision cards, the reminder email outbox and medicine-change proposals. */
import type { DecisionCard, Proposal, ReminderOutbox } from "../types";
import { formatIstIso } from "../time";
import { all, batch, one, run, type Stmt } from "./driver";

/** AI decision cards of one household, newest first. */
export async function listDecisionCards(hh: string) {
  return all<DecisionCard>(`SELECT * FROM decision_cards WHERE household_id = ? ORDER BY created_at DESC`, [hh]);
}
/** Get decision card, scoped to one household. */
export async function getDecisionCard(hh: string, id: string) {
  return one<DecisionCard>(`SELECT * FROM decision_cards WHERE id = ? AND household_id = ?`, [id, hh]);
}
/** Insert decision card (batch statement). */
export const insertDecisionCardStmt = (c: DecisionCard): Stmt => ({
  sql: `INSERT INTO decision_cards (id,household_id,source_event_id,severity,title,elder_line_hi,caretaker_line_hi,family_line_en,tell_doctor,disclaimer,emergency_line,cached,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  args: [
    c.id,
    c.household_id,
    c.source_event_id,
    c.severity,
    c.title,
    c.elder_line_hi,
    c.caretaker_line_hi,
    c.family_line_en,
    c.tell_doctor,
    c.disclaimer,
    c.emergency_line,
    c.cached,
    c.created_at,
  ],
});
/** Insert decision card. */
export async function insertDecisionCard(c: DecisionCard) {
  await batch([insertDecisionCardStmt(c)]);
}

// ---------- outbox ----------
/** Reminder emails queued or sent for one household, newest first. */
export async function listOutbox(hh: string) {
  return all<ReminderOutbox>(`SELECT * FROM reminder_outbox WHERE household_id = ? ORDER BY created_at DESC`, [hh]);
}
/** Returns false when the idempotency key already exists (no duplicate email). */
export async function insertOutbox(r: ReminderOutbox): Promise<boolean> {
  const n = await run(
    `INSERT INTO reminder_outbox (id,household_id,kind,to_email,subject,body,idempotency_key,status,created_at,sent_at,error) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`,
    [
      r.id,
      r.household_id,
      r.kind,
      r.to_email,
      r.subject,
      r.body,
      r.idempotency_key,
      r.status,
      r.created_at,
      r.sent_at,
      r.error,
    ],
  );
  return n === 1;
}
/** Update outbox status. */
export async function updateOutboxStatus(id: string, status: ReminderOutbox["status"], error: string | null = null) {
  await run(`UPDATE reminder_outbox SET status = ?, sent_at = ?, error = ? WHERE id = ?`, [
    status,
    status === "sent" || status === "mock" ? formatIstIso() : null,
    error,
    id,
  ]);
}

/** Medicine-change proposals of one household, newest first. */
export async function listProposals(hh: string) {
  return all<Proposal>(`SELECT * FROM proposals WHERE household_id = ? ORDER BY created_at DESC`, [hh]);
}
/** Insert proposal. */
export async function insertProposal(
  hh: string,
  p: { id: string; kind: string; medicine_id: string | null; payload: unknown; created_by: string },
) {
  await run(
    `INSERT INTO proposals (id,household_id,kind,medicine_id,payload_json,status,created_by,created_at) VALUES (?,?,?,?,?, 'pending', ?, ?)`,
    [p.id, hh, p.kind, p.medicine_id, JSON.stringify(p.payload), p.created_by, formatIstIso()],
  );
}
/** Update proposal status, scoped to one household. */
export async function updateProposalStatus(hh: string, id: string, status: string) {
  await run(`UPDATE proposals SET status = ? WHERE id = ? AND household_id = ?`, [status, id, hh]);
}
/** Get proposal, scoped to one household. */
export async function getProposal(hh: string, id: string) {
  return one<Proposal>(`SELECT * FROM proposals WHERE id = ? AND household_id = ?`, [id, hh]);
}
