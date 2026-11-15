/** RESET_ADMIN_CODE wipes the ephemeral database (admin only). Never shown in the UI. */

let generatedResetCode: string | null = null;
export function getResetAdminCode(): string {
  const v = process.env.RESET_ADMIN_CODE;
  if (v && v.length > 0) return v;
  if (process.env.NODE_ENV === "production") {
    // No env set in production: use an unguessable per-process code (reset effectively disabled).
    if (!generatedResetCode) {
      generatedResetCode = `${Date.now()}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    }
    return generatedResetCode;
  }
  return "999999"; // local dev only
}

export const EMERGENCY_LINE =
  "Emergency: call 108 or go to the nearest hospital. ApnaHaath does not triage emergencies.";

export const MEDICAL_DISCLAIMER =
  "ApnaHaath is a care log. It is not a doctor, not a diagnosis, and not a CDSCO medical device. It does not start, stop, or change medicines. Consult a qualified clinician or pharmacist.";

export const LOCKOUT_MAX_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 5;
export const MISS_GRACE_MINUTES = 90;
export const SESSION_COOKIE = "apnahaath_session";
export const RESET_RATE_LIMIT_MS = 60_000;
