export type Role = "elder" | "caretaker" | "family";

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  is_demo: number;
  created_at: string;
}

export interface Household {
  id: string;
  elder_name: string;
  elder_age: number | null;
  city: string;
  language: string;
  owner_user_id: string;
  is_demo: number;
  demo_credentials_json: string | null;
  created_at: string;
}

export interface Membership {
  id: string;
  user_id: string;
  household_id: string;
  role: Role;
  pin_hash: string;
  failed_attempts: number;
  lockout_until: string | null;
  created_at: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Medicine {
  id: string;
  household_id: string;
  name: string;
  brand_hi: string;
  dose: string;
  schedule_time: string;
  instructions: string;
  color_band: string;
  active: number;
  notes: string | null;
}

export interface DoseSlot {
  id: string;
  household_id: string;
  medicine_id: string;
  scheduled_at: string;
  status: "pending" | "elder_confirmed" | "skipped" | "missed";
  skip_reason: string | null;
}

export interface Appointment {
  id: string;
  household_id: string;
  doctor: string;
  place: string;
  scheduled_at: string;
  notes: string | null;
}

export interface CareEvent {
  id: string;
  household_id: string;
  type: string;
  actor_role: string;
  actor_name: string;
  medicine_id: string | null;
  dose_slot_id: string | null;
  appointment_id: string | null;
  payload_json: string;
  created_at: string;
}

export interface DecisionCard {
  id: string;
  household_id: string;
  source_event_id: string | null;
  severity: string;
  title: string;
  elder_line_hi: string;
  caretaker_line_hi: string;
  family_line_en: string;
  tell_doctor: string;
  disclaimer: string;
  emergency_line: string;
  cached: number;
  created_at: string;
}

export interface ReminderOutbox {
  id: string;
  household_id: string;
  kind: "upcoming" | "missed" | "appointment";
  to_email: string;
  subject: string;
  body: string;
  idempotency_key: string;
  status: "queued" | "sent" | "failed" | "mock";
  created_at: string;
  sent_at: string | null;
  error: string | null;
}

export interface Proposal {
  id: string;
  household_id: string;
  kind: string;
  medicine_id: string | null;
  payload_json: string;
  status: string;
  created_by: string;
  created_at: string;
}

export interface AdherenceStats {
  elderConfirmed: number;
  witnessed: number;
  skipped: number;
  missed: number;
  pending: number;
  dueOrPast: number;
  elderConfirmationRate: number | null;
}
