/** Fetch wrapper for the JSON API and IST date/time display helpers. */
import { formatTime12 } from "@/lib/time";

export async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export function time12(value: string) {
  return formatTime12(value);
}

export function dayLabel(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00+05:30`);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}
