import { NextResponse } from "next/server";
import { dedupeCards } from "@/lib/cards";
import { requireMember } from "@/lib/auth";
import {
  ensureTodaySlots,
  getAdherenceStats,
  listAppointments,
  listDecisionCards,
  listDoseSlots,
  listEvents,
  listInvites,
  listMedicines,
  listMembers,
  listOutbox,
  listProposals,
  listRecentSlots,
} from "@/lib/db";
import { addDaysIst, todayIstDateString } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everything for the active care circle — only for its members. */
export async function GET() {
  const a = await requireMember();
  if ("error" in a) return a.error;
  const { household, user, role } = a.ctx;
  const hh = household.id;
  await ensureTodaySlots(hh);
  const isOwner = household.owner_user_id === user.id;
  const [members, medicines, doseSlots, history, appointments, events, cards, proposals, outbox, adherence, invites] =
    await Promise.all([
      listMembers(hh),
      listMedicines(hh),
      listDoseSlots(hh),
      listRecentSlots(hh, addDaysIst(todayIstDateString(), -6)),
      listAppointments(hh),
      listEvents(hh, 60),
      listDecisionCards(hh),
      listProposals(hh),
      role === "family" ? listOutbox(hh) : Promise.resolve([]),
      getAdherenceStats(hh),
      isOwner ? listInvites(hh) : Promise.resolve([]),
    ]);
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
    adherence,
    invites,
  });
}
