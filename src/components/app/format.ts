/** Small, pure display helpers for the care app (UI only; no data access). */

import type { MsgKey } from "@/lib/i18n";

/** Dictionary key for the part of the day of a clock time ("" when the time can't be read). */
export function dayPartKey(value: string): MsgKey | "" {
  const m = /T(\d{2}):(\d{2})/.exec(value) || /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return "";
  const h = Number(m[1]);
  if (h >= 4 && h < 12) return "part.morning";
  if (h >= 12 && h < 17) return "part.afternoon";
  if (h >= 17 && h < 20) return "part.evening";
  return "part.night";
}

/** Dictionary key for the greeting at an IST hour. */
export function greetingKey(hourIst: number): MsgKey {
  if (hourIst >= 4 && hourIst < 12) return "greet.morning";
  if (hourIst >= 12 && hourIst < 17) return "greet.afternoon";
  return "greet.evening";
}

/** Current hour in Asia/Kolkata (0–23). */
export function istHour(date: Date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(date);
  return Number(h) % 24;
}

/**
 * Google Maps search URL (documented "Maps URLs" format, no API key, nothing sent by the app):
 * opens Google Maps for e.g. "24 hour pharmacy near Lucknow". Uses "near me" when no city is known.
 */
export function mapsSearchUrl(place: "hospital" | "pharmacy", city?: string | null): string {
  const what = place === "pharmacy" ? "24 hour pharmacy" : "hospital emergency";
  const where = city && city.trim() ? `near ${city.trim()}` : "near me";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${what} ${where}`)}`;
}
