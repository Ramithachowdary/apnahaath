/** Idempotent schema: every statement is safe to re-run on each cold start. */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY, elder_name TEXT NOT NULL, elder_age INTEGER, city TEXT NOT NULL,
  language TEXT NOT NULL, owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_demo INTEGER NOT NULL DEFAULT 0, demo_credentials_json TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('elder','caretaker','family')),
  pin_hash TEXT NOT NULL, failed_attempts INTEGER NOT NULL DEFAULT 0, lockout_until TEXT,
  created_at TEXT NOT NULL, UNIQUE (user_id, household_id)
);
CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('elder','caretaker','family')), code_hash TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL,
  used_by TEXT REFERENCES users(id) ON DELETE SET NULL, used_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS medicines (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL, brand_hi TEXT NOT NULL, dose TEXT NOT NULL, schedule_time TEXT NOT NULL,
  instructions TEXT NOT NULL, color_band TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, notes TEXT
);
CREATE TABLE IF NOT EXISTS dose_slots (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  medicine_id TEXT NOT NULL REFERENCES medicines(id) ON DELETE CASCADE, scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','elder_confirmed','skipped','missed')), skip_reason TEXT
);
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  doctor TEXT NOT NULL, place TEXT NOT NULL, scheduled_at TEXT NOT NULL, notes TEXT
);
-- Append-only authorship log: the app only ever INSERTs into care_events.
CREATE TABLE IF NOT EXISTS care_events (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  type TEXT NOT NULL, actor_role TEXT NOT NULL, actor_name TEXT NOT NULL, medicine_id TEXT,
  dose_slot_id TEXT, appointment_id TEXT, payload_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS decision_cards (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  source_event_id TEXT, severity TEXT NOT NULL, title TEXT NOT NULL, elder_line_hi TEXT NOT NULL,
  caretaker_line_hi TEXT NOT NULL, family_line_en TEXT NOT NULL, tell_doctor TEXT NOT NULL,
  disclaimer TEXT NOT NULL, emergency_line TEXT NOT NULL, cached INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reminder_outbox (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, to_email TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE, status TEXT NOT NULL, created_at TEXT NOT NULL, sent_at TEXT, error TEXT
);
CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, medicine_id TEXT, payload_json TEXT NOT NULL, status TEXT NOT NULL,
  created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS email_otps (
  user_id TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at BIGINT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0, last_sent_at BIGINT NOT NULL
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_household ON memberships(household_id);
CREATE INDEX IF NOT EXISTS idx_events_household ON care_events(household_id, created_at);
CREATE INDEX IF NOT EXISTS idx_slots_household ON dose_slots(household_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meds_household ON medicines(household_id);
CREATE INDEX IF NOT EXISTS idx_outbox_household ON reminder_outbox(household_id);
CREATE INDEX IF NOT EXISTS idx_slots_medicine ON dose_slots(medicine_id);
CREATE INDEX IF NOT EXISTS idx_appointments_household ON appointments(household_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_cards_household ON decision_cards(household_id, created_at);
CREATE INDEX IF NOT EXISTS idx_proposals_household ON proposals(household_id, created_at);
CREATE INDEX IF NOT EXISTS idx_invites_household ON invites(household_id, created_at);
`;
