/** Google Calendar "Add event" template URL — no API key, opens in the user's Google Calendar. */

/** An appointment to open in Google Calendar. */
export interface CalendarEvent {
  title: string;
  startIso: string;
  location?: string;
  details?: string;
  durationMinutes?: number;
}

/** Treat a wall-clock time with no offset as IST, matching how appointments are stored. */
export function normalizeAppointmentIso(iso: string): string {
  const trimmed = iso.trim();
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00+05:30`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}+05:30`;
  return trimmed;
}

function toUtcStamp(ms: number): string {
  return new Date(ms)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

/** Google Calendar "add event" template URL for an appointment (IST, default 1 hour). */
export function googleCalendarUrl(event: CalendarEvent): string {
  const startMs = Date.parse(normalizeAppointmentIso(event.startIso));
  if (Number.isNaN(startMs)) {
    throw new Error("Invalid appointment time");
  }
  const endMs = startMs + (event.durationMinutes ?? 60) * 60_000;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toUtcStamp(startMs)}/${toUtcStamp(endMs)}`,
  });
  if (event.location) params.set("location", event.location);
  if (event.details) params.set("details", event.details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
