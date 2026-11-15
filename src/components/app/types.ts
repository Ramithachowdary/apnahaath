/** Shared client-side shapes of the /api/state and /api/auth/me responses. */
import type { TABS } from "./constants";

export type Role = "elder" | "caretaker" | "family";

export type Me = {
  authenticated: boolean;
  user?: { id: string; name: string; email: string };
  households?: Array<{ id: string; elder_name: string; city: string; role: Role }>;
  activeHouseholdId?: string | null;
};

export type Slot = {
  id: string;
  medicine_id: string;
  medicine_name: string;
  brand_hi: string;
  color_band: string;
  instructions: string;
  scheduled_at: string;
  status: string;
  skip_reason: string | null;
};

export type Card = {
  id: string;
  severity: string;
  title: string;
  elder_line_hi: string;
  caretaker_line_hi: string;
  family_line_en: string;
  tell_doctor: string;
  disclaimer: string;
  emergency_line: string;
  created_at: string;
};

export type State = {
  me: { id: string; name: string; email: string; role: Role; isOwner: boolean };
  household: { id: string; elder_name: string; elder_age: number | null; city: string; language: string };
  members: Array<{ id: string; name: string; role: Role }>;
  medicines: Array<{
    id: string;
    name: string;
    dose: string;
    schedule_time: string;
    instructions: string;
    color_band: string;
    active: number;
  }>;
  doseSlots: Slot[];
  history: Slot[];
  appointments: Array<{ id: string; doctor: string; place: string; scheduled_at: string; notes: string | null }>;
  events: Array<{
    id: string;
    type: string;
    actor_name: string;
    actor_role: string;
    created_at: string;
    payload_json: string;
  }>;
  cards: Card[];
  proposals: Array<{
    id: string;
    kind: string;
    medicine_id: string | null;
    payload_json: string;
    status: string;
    created_by: string;
    created_at: string;
  }>;
  outbox: Array<{
    id: string;
    kind: string;
    to_email: string;
    subject: string;
    body?: string;
    status: string;
    created_at: string;
  }>;
  adherence: {
    elderConfirmed: number;
    witnessed: number;
    skipped: number;
    missed: number;
    pending: number;
    elderConfirmationRate: number | null;
  };
  invites: Array<{ id: string; role: Role; expires_at: string; used_by: string | null; created_at: string }>;
};

export type Tab = (typeof TABS)[number];

export type ActFn = (fn: () => Promise<unknown>, okText?: string) => Promise<void>;
