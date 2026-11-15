import { NextResponse } from "next/server";
import { dedupeCards } from "@/lib/cards";
import { requireMember } from "@/lib/auth";
import {
  countWitnessedToday,
  ensureTodaySlots,
  listAppointments,
  listDecisionCards,
  listEvents,
  listInvites,
  listMedicines,
  listMembers,
  listOutbox,
  listProposals,
  listRecentSlots,
  summarizeAdherence,
} from "@/lib/db";
import { addDaysIst, todayIstDateString } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Days of dose history (including today) returned for the History tab. */
const HISTORY_DAYS = 7;
/** Most recent care events returned for the activity feed. */
const EVENT_LIMIT = 60;

/**
 * Everything for the active care circle, only for its members. Today's slots are created first,
 * then every read runs in parallel; today's schedule and adherence are derived from the 7-day
 * history instead of being queried again.
 */
export async function GET() {
  const a = await requireMember();
  if ("error" in a) return a.error;
  const { household, user, role } = a.ctx;
  const hh = household.id;
  await ensureTodaySlots(hh);
  const isOwner = household.owner_user_id === user.id;
  const today = todayIstDateString();
  const [members, medicines, history, appointments, events, cards, proposals, outbox, witnessed, invites] =
    await Promise.all([
      listMembers(hh),
      listMedicines(hh),
      listRecentSlots(hh, addDaysIst(today, 1 - HISTORY_DAYS)),
      listAppointments(hh),
      listEvents(hh, EVENT_LIMIT),
      listDecisionCards(hh),
      listProposals(hh),
      role === "family" ? listOutbox(hh) : Promise.resolve([]),
      countWitnessedToday(hh),
      isOwner ? listInvites(hh) : Promise.resolve([]),
    ]);
  // History is newest first; today's schedule reads in time order.
  const doseSlots = history.filter((s) => s.scheduled_at.startsWith(today)).reverse();
  return NextResponse.json({
    me: { id: user.id, name: user.name, email: user.email, role, isOwner },
    household: {
      id: hh,
      elder_name: household.elder_name,
      elder_age: household.elder_age,
      city: household.city,
      language: household.language,
    },
    members: members.map((m) => ({ id: m.id, name: m.name, role: m.role })),
    medicines,
    doseSlots,
    history,
    appointments,
    events,
    cards: dedupeCards(cards, [...medicines.map((m) => m.name), "Brufen"]),
    proposals,
    outbox,
    adherence: summarizeAdherence(doseSlots, witnessed),
    invites,
  });
}
