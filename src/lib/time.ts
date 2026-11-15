/** Asia/Kolkata helpers */

export function formatIstIso(date: Date = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}+05:30`;
}

export function todayIstDateString(): string {
  return formatIstIso().slice(0, 10);
}

export function istDateTimeOnToday(hhmm: string): string {
  const day = todayIstDateString();
  const [h, m] = hhmm.split(":");
  return `${day}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+05:30`;
}

export function parseIstMs(iso: string): number {
  return Date.parse(iso);
}

export function minutesSince(iso: string): number {
  return (Date.now() - parseIstMs(iso)) / 60000;
}

export function addDaysIst(isoDate: string, days: number): string {
  const base = Date.parse(`${isoDate}T12:00:00+05:30`);
  const d = new Date(base + days * 86400000);
  return formatIstIso(d).slice(0, 10);
}

/** Clock time for people: "8:00 AM". Accepts HH:MM or an ISO string with a T-time. */
export function formatTime12(value: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(value) || /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!m) return value;
  const h = Number(m[1]);
  const min = m[2];
  if (Number.isNaN(h) || h < 0 || h > 23) return value;
  return `${((h + 11) % 12) + 1}:${min} ${h >= 12 ? "PM" : "AM"}`;
}
