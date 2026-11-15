/** Role inside a care circle. */
export type Role = "elder" | "caretaker" | "family";

/** A signed-up account. */
export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  is_demo: number;
  email_verified?: number;
  google_id?: string | null;
  created_at: string;
}

/** A care circle: exactly one elder, any number of caretakers and family. */
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

/** A user's role in one care circle. */
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

/** A member as shown to others in the circle. */
export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/** A medicine on the elder's list (added by her, or accepted from a proposal). */
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

/** One scheduled dose for a day and its status. */
export interface DoseSlot {
  id: string;
  household_id: string;
  medicine_id: string;
  scheduled_at: string;
  status: "pending" | "elder_confirmed" | "skipped" | "missed";
  skip_reason: string | null;
}

/** A doctor visit. */
export interface Appointment {
  id: string;
  household_id: string;
  doctor: string;
  place: string;
  scheduled_at: string;
  notes: string | null;
}

/** An append-only care log entry. */
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

/** A warn-only safety note. */
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

/** A queued or sent reminder email (idempotent by id). */
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

/** A family suggestion (add / change time / stop) waiting for the elder. */
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

/** Taken / missed / skipped counts for a period. */
export interface AdherenceStats {
  elderConfirmed: number;
  witnessed: number;
  skipped: number;
  missed: number;
  pending: number;
  dueOrPast: number;
  elderConfirmationRate: number | null;
}
