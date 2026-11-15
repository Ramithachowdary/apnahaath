/** Shown on every safety note and the footer: the app never triages emergencies. */
export const EMERGENCY_LINE =
  "Emergency: call 108 or go to the nearest hospital. ApnaHaath does not triage emergencies.";

/** Shown with AI output: the app is a log, not a doctor or a prescriber. */
export const MEDICAL_DISCLAIMER =
  "ApnaHaath is a care log. It is not a doctor, not a diagnosis, and not a CDSCO medical device. It does not start, stop, or change medicines. Consult a qualified clinician or pharmacist.";

/** Wrong password attempts allowed before a temporary lockout. */
export const LOCKOUT_MAX_ATTEMPTS = 5;
/** Length of a lockout, in minutes. */
export const LOCKOUT_MINUTES = 5;
/** A pending dose counts as missed this many minutes after its time. */
export const MISS_GRACE_MINUTES = 90;
/** Name of the signed, httpOnly session cookie. */
export const SESSION_COOKIE = "apnahaath_session";
