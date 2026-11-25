"use client";

/** Small shared UI pieces: status chip, time field, display toggles, footer, share and calendar buttons. */
import { useEffect, useState } from "react";
import { HandHeart, LogOut } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { googleCalendarUrl } from "@/lib/calendar";
import { formatTime12 } from "@/lib/time";
import { mapsSearchUrl } from "./format";
import type { Me, State } from "./types";
import { CHIP } from "./constants";
import { useT } from "./lang";
import type { MsgKey } from "@/lib/i18n";

export function StatusChip({ status, extra }: { status: string; extra?: string | null }) {
  const { tr } = useT();
  const c = CHIP[status] ?? CHIP.pending;
  const key = `status.${CHIP[status] ? status : "pending"}` as MsgKey;
  return (
    <span className={`chip ${c.cls}`}>
      <c.Icon size={16} aria-hidden="true" />
      {tr(key)}
      {extra ? ` · ${extra}` : ""}
    </span>
  );
}

/** Time or datetime field with a visible 12-hour AM/PM preview (native pickers are often 24-hour). */
export function TimeField({
  type = "time",
  value,
  onChange,
  label,
  className,
}: {
  type?: "time" | "datetime-local";
  value: string;
  onChange: (v: string) => void;
  label: string;
  className?: string;
}) {
  const preview = value ? formatTime12(value) : "";
  return (
    <label className="grid gap-1">
      <span className="text-sm font-semibold">
        {label}
        {preview ? ` · ${preview}` : " (AM/PM)"}
      </span>
      <input
        className={className ?? "input"}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label}${preview ? `, ${preview}` : ""}`}
      />
    </label>
  );
}

export function AppFooter({ city }: { city?: string | null }) {
  return (
    <footer className="mt-12 border-t pt-5 text-sm" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
      <p className="font-semibold text-[var(--danger)]">
        Emergency: call <a href="tel:108">108</a> or go to the nearest hospital.
      </p>
      <p className="no-print my-2 flex flex-wrap gap-x-4 gap-y-1">
        <a className="underline" href={mapsSearchUrl("hospital", city)} target="_blank" rel="noopener noreferrer">
          Nearest hospital on Google Maps
        </a>
        <a className="underline" href={mapsSearchUrl("pharmacy", city)} target="_blank" rel="noopener noreferrer">
          24-hour pharmacy on Google Maps
        </a>
      </p>
      <p>
        ApnaHaath is a care log. It is not a doctor and does not start, stop or change medicines. Talk to a qualified
        doctor or pharmacist.
      </p>
    </footer>
  );
}

/** Large text and high contrast, remembered on this device. Labels show the action: Large/Small, High/Normal contrast. */
export function DisplayToggles() {
  const [large, setLarge] = useState(false);
  const [contrast, setContrast] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const l = localStorage.getItem("ah-large") === "1";
      const c = localStorage.getItem("ah-contrast") === "1";
      setLarge(l);
      setContrast(c);
      document.documentElement.classList.toggle("ah-large", l);
      document.documentElement.classList.toggle("ah-contrast", c);
    } catch {
      /* storage blocked */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.classList.toggle("ah-large", large);
    document.documentElement.classList.toggle("ah-contrast", contrast);
    try {
      localStorage.setItem("ah-large", large ? "1" : "0");
      localStorage.setItem("ah-contrast", contrast ? "1" : "0");
    } catch {
      /* storage blocked */
    }
  }, [large, contrast, ready]);
  return (
    <div className="no-print mb-3 flex flex-wrap gap-2" role="group" aria-label="Display settings">
      <button
        type="button"
        className="btn-ghost"
        aria-pressed={large}
        aria-label={large ? "Small text" : "Large text"}
        onClick={() => setLarge((v) => !v)}
      >
        {large ? "Small" : "Large"}
      </button>
      <button
        type="button"
        className="btn-ghost"
        aria-pressed={contrast}
        aria-label={contrast ? "Normal contrast" : "High contrast"}
        onClick={() => setContrast((v) => !v)}
      >
        {contrast ? "Normal contrast" : "High contrast"}
      </button>
      <ThemeToggle />
    </div>
  );
}

export function TopBar({ me, onLogout }: { me: Me | null; state: State | null; onLogout: () => void }) {
  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-lg font-bold text-[var(--brand)]">
        <HandHeart size={24} aria-hidden="true" /> ApnaHaath
      </p>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {me?.authenticated && (
          <button className="btn-ghost" onClick={onLogout}>
            <LogOut size={18} aria-hidden="true" /> Sign out
          </button>
        )}
      </div>
    </header>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed p-6 text-center text-[var(--muted)]">{children}</p>;
}

export function AddToGoogleCalendar({
  appointment,
  elderName,
}: {
  appointment: State["appointments"][number];
  elderName: string;
}) {
  const href = googleCalendarUrl({
    title: `${appointment.doctor}, ${elderName}`,
    startIso: appointment.scheduled_at,
    location: appointment.place,
    details: appointment.notes ?? `Appointment for ${elderName} at ${appointment.place}`,
  });
  return (
    <a
      className="mt-2 inline-flex min-h-[44px] items-center font-semibold underline"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      Add to Google Calendar
    </a>
  );
}

/** Copy a care message, share it with the native share sheet (when available), or open WhatsApp. */
export function ShareButtons({ text, label = "message" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this text", text);
    }
  }
  return (
    <span className="no-print inline-flex flex-wrap gap-2">
      <button type="button" className="btn-ghost" onClick={copy} aria-label={`Copy this ${label}`}>
        {copied ? "Copied ✓" : "Copy"}
      </button>
      {canShare && (
        <button
          type="button"
          className="btn-ghost"
          onClick={() => navigator.share({ title: "ApnaHaath", text }).catch(() => undefined)}
          aria-label={`Share this ${label}`}
        >
          Share
        </button>
      )}
      <a
        className="btn-ghost"
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Send this ${label} on WhatsApp`}
      >
        WhatsApp
      </a>
    </span>
  );
}
