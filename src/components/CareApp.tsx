"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  Eye,
  HandHeart,
  History as HistoryIcon,
  LogOut,
  MinusCircle,
  Pill,
  ShieldCheck,
  Stethoscope,
  Users,
  XCircle,
} from "lucide-react";
import Landing from "./Landing";
import { googleCalendarUrl } from "@/lib/calendar";
import { formatTime12 } from "@/lib/time";

type Role = "elder" | "caretaker" | "family";
type Me = {
  authenticated: boolean;
  user?: { id: string; name: string; email: string };
  households?: Array<{ id: string; elder_name: string; city: string; role: Role }>;
  activeHouseholdId?: string | null;
};
type Slot = {
  id: string;
  medicine_id: string;
  medicine_name: string;
  brand_hi: string;
  color_band: string;
  instructions: string;
  scheduled_at: string;
  status: string;
  skip_reason: string | null;
};
type Card = {
  id: string;
  severity: string;
  title: string;
  elder_line_hi: string;
  caretaker_line_hi: string;
  family_line_en: string;
  tell_doctor: string;
  disclaimer: string;
  emergency_line: string;
  created_at: string;
};
type State = {
  me: { id: string; name: string; email: string; role: Role; isOwner: boolean };
  household: { id: string; elder_name: string; elder_age: number | null; city: string; language: string };
  members: Array<{ id: string; name: string; role: Role }>;
  medicines: Array<{
    id: string;
    name: string;
    dose: string;
    schedule_time: string;
    instructions: string;
    color_band: string;
    active: number;
  }>;
  doseSlots: Slot[];
  history: Slot[];
  appointments: Array<{ id: string; doctor: string; place: string; scheduled_at: string; notes: string | null }>;
  events: Array<{
    id: string;
    type: string;
    actor_name: string;
    actor_role: string;
    created_at: string;
    payload_json: string;
  }>;
  cards: Card[];
  proposals: Array<{
    id: string;
    kind: string;
    medicine_id: string | null;
    payload_json: string;
    status: string;
    created_by: string;
    created_at: string;
  }>;
  outbox: Array<{
    id: string;
    kind: string;
    to_email: string;
    subject: string;
    body?: string;
    status: string;
    created_at: string;
  }>;
  adherence: {
    elderConfirmed: number;
    witnessed: number;
    skipped: number;
    missed: number;
    pending: number;
    elderConfirmationRate: number | null;
  };
  invites: Array<{ id: string; role: Role; expires_at: string; used_by: string | null; created_at: string }>;
};

const SKIP_REASONS = ["Fasting", "Upset stomach", "Ran out", "Forgot", "Other"];
const STATUS_LABEL: Record<string, string> = {
  pending: "Not answered yet",
  elder_confirmed: "Taken — confirmed by the elder",
  skipped: "Skipped",
  missed: "Missed / not confirmed",
};
const ROLE_LABEL: Record<Role, string> = { elder: "Elder", caretaker: "Caretaker", family: "Family" };
const EVENT_LABEL: Record<string, string> = {
  elder_confirmed: "confirmed a dose",
  witnessed: "witnessed a dose (not counted as taken)",
  skipped: "skipped a dose",
  missed: "— dose not confirmed in time",
  self_added: "recorded a medicine she took herself",
  change_proposed: "suggested a change",
  stop_proposed: "suggested stopping a medicine",
  change_accepted: "accepted a suggestion",
  change_rejected: "said no to a suggestion",
  appointment_created: "added an appointment",
  appointment_updated: "updated an appointment",
  member_joined: "joined the care circle",
};
const TABS = ["Today", "Medicines", "History", "Appointments", "Care circle", "Safety & AI"] as const;
const TAB_ICON = {
  Today: CalendarCheck,
  Medicines: Pill,
  History: HistoryIcon,
  Appointments: Stethoscope,
  "Care circle": Users,
  "Safety & AI": ShieldCheck,
} as const;
const TAB_SUB: Record<string, string> = {
  Today: "Today's doses. Only the elder marks a dose as taken.",
  Medicines: "The medicine list. Family suggests, the elder decides.",
  History: "The last 7 days, and who did what.",
  Appointments: "Doctor visits and reminders.",
  "Care circle": "Who is in this circle, and invites.",
  "Safety & AI": "Safety notes, the doctor memo and email reminders.",
};
const CHIP: Record<string, { label: string; Icon: typeof CheckCircle2; cls: string }> = {
  elder_confirmed: { label: "Confirmed", Icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  witnessed: { label: "Witnessed", Icon: Eye, cls: "bg-sky-50 text-sky-800 ring-sky-200" },
  skipped: { label: "Skipped", Icon: MinusCircle, cls: "bg-amber-50 text-amber-900 ring-amber-200" },
  missed: { label: "Missed", Icon: XCircle, cls: "bg-red-50 text-red-800 ring-red-200" },
  pending: { label: "Not answered yet", Icon: Clock, cls: "bg-stone-100 text-stone-700 ring-stone-200" },
};
function StatusChip({ status, extra }: { status: string; extra?: string | null }) {
  const c = CHIP[status] ?? CHIP.pending;
  return (
    <span className={`chip ${c.cls}`}>
      <c.Icon size={16} aria-hidden="true" />
      {c.label}
      {extra ? ` · ${extra}` : ""}
    </span>
  );
}
type Tab = (typeof TABS)[number];

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText) as Error & { needPin?: boolean };
    err.needPin = Boolean(data.needPin);
    throw err;
  }
  return data;
}

function time12(value: string) {
  return formatTime12(value);
}

/** Time or datetime field with a visible 12-hour AM/PM preview (native pickers are often 24-hour). */
function TimeField({
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
function dayLabel(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00+05:30`);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

export default function CareApp({
  hasSession = true,
  googleEnabled = false,
}: {
  hasSession?: boolean;
  googleEnabled?: boolean;
}) {
  // Without a session cookie the landing page renders on the server (no loading flash / layout shift).
  const [me, setMe] = useState<Me | null>(hasSession ? null : { authenticated: false });
  const [state, setState] = useState<State | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState("");
  const [pinReq, setPinReq] = useState<{ fn: (pin: string) => Promise<unknown>; okText?: string } | null>(null);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), msg.ok ? 4000 : 8000);
    return () => clearTimeout(t);
  }, [msg]);

  const refresh = useCallback(async () => {
    const m = (await api("/api/auth/me")) as Me;
    setMe(m);
    if (m.authenticated && m.activeHouseholdId) setState((await api("/api/state")) as State);
    else setState(null);
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const code = qs.get("invite");
    if (code) setInvite(code);
    const authError = qs.get("auth_error");
    if (authError) {
      setMsg({
        text:
          authError === "google_unavailable"
            ? "Google sign-in is not available right now. Please use email."
            : "Google sign-in did not finish. Please try again or use email.",
      });
      window.history.replaceState(
        null,
        "",
        window.location.pathname + (code ? `?invite=${encodeURIComponent(code)}` : ""),
      );
    }
    refresh().catch((e) => setMsg({ text: String(e.message || e) }));
  }, [refresh]);

  async function act(fn: () => Promise<unknown>, okText?: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      await refresh();
      if (okText) setMsg({ text: okText, ok: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Something went wrong" });
    } finally {
      setBusy(false);
    }
  }

  /**
   * Authoring actions try first without a PIN: the server accepts them while the member's
   * 15-minute PIN window is open, and replies `needPin` otherwise — only then the PIN dialog opens.
   */
  async function withPin(fn: (pin: string) => Promise<unknown>, okText?: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn("");
      await refresh();
      if (okText) setMsg({ text: okText, ok: true });
    } catch (e) {
      if (e instanceof Error && (e as Error & { needPin?: boolean }).needPin) setPinReq({ fn, okText });
      else setMsg({ text: e instanceof Error ? e.message : "Something went wrong" });
    } finally {
      setBusy(false);
    }
  }

  const logout = () => act(() => api("/api/auth/logout", { method: "POST" }));
  const overlay = (
    <>
      {msg && (
        <div className="no-print fixed inset-x-4 bottom-24 z-40 flex justify-center lg:bottom-6 lg:left-auto lg:right-6 lg:justify-end">
          <p
            role="status"
            className={`flex max-w-md items-start gap-2 rounded-2xl border px-4 py-3 shadow-lg ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}
          >
            {msg.ok ? (
              <CheckCircle2 size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <XCircle size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <span>{msg.text}</span>
            <button
              type="button"
              className="ml-2 font-semibold underline"
              onClick={() => setMsg(null)}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </p>
        </div>
      )}
      {pinReq && (
        <PinDialog
          onCancel={() => setPinReq(null)}
          onSubmit={(pin) => {
            const req = pinReq;
            setPinReq(null);
            void act(() => req.fn(pin), req.okText);
          }}
        />
      )}
    </>
  );

  if (!me) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-6xl px-5 py-16" aria-busy="true">
        <p className="text-lg text-[var(--muted)]">Opening your care circle…</p>
      </main>
    );
  }
  if (!me.authenticated) {
    return (
      <>
        <Landing
          busy={busy}
          invite={invite}
          googleEnabled={googleEnabled}
          toggles={<DisplayToggles />}
          onAuth={async (path, body, okText) => {
            setBusy(true);
            setMsg(null);
            try {
              const res = await fetch(path, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              });
              const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
              if (!res.ok) setMsg({ text: String(data.error || "Something went wrong") });
              else if (okText) setMsg({ text: okText, ok: true });
              if (res.ok && !data.needsVerification && path !== "/api/auth/resend") await refresh();
              return { ok: res.ok, ...data };
            } catch {
              setMsg({ text: "Network problem. Please try again." });
              return { ok: false };
            } finally {
              setBusy(false);
            }
          }}
        />
        {overlay}
      </>
    );
  }
  if (!state) {
    return (
      <>
        <main className="mx-auto max-w-5xl px-5 py-8 pb-24">
          <TopBar me={me} state={null} onLogout={logout} />
          <Onboarding me={me} busy={busy} act={act} invite={invite} />
          <AppFooter />
        </main>
        {overlay}
      </>
    );
  }
  return (
    <>
      <Dashboard state={state} busy={busy} act={act} withPin={withPin} setMsg={setMsg} onLogout={logout} />
      {overlay}
    </>
  );
}

function AppFooter() {
  return (
    <footer className="mt-12 border-t border-stone-200 pt-5 text-sm text-[var(--muted)]">
      <p className="font-semibold text-[var(--danger)]">Emergency: call 108 or go to the nearest hospital.</p>
      <p>
        ApnaHaath is a care log. It is not a doctor and does not start, stop or change medicines. Talk to a qualified
        doctor or pharmacist.
      </p>
    </footer>
  );
}

/** Large text and high contrast, remembered on this device. Labels show the action: Large/Small, High/Normal contrast. */
function DisplayToggles() {
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
    </div>
  );
}

function PinDialog({ onSubmit, onCancel }: { onSubmit: (pin: string) => void; onCancel: () => void }) {
  const [pin, setPin] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="presentation"
      onClick={onCancel}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-title"
        className="panel w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (/^\d{4,8}$/.test(pin)) onSubmit(pin);
        }}
      >
        <h2 id="pin-title" className="text-xl font-semibold">
          Confirm with your PIN
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Confirm it’s you — your PIN signs this change. We won’t ask again for 15 minutes.
        </p>
        <label className="mt-3 block text-sm font-semibold" htmlFor="pin-input">
          PIN (4–8 digits)
        </label>
        <input
          id="pin-input"
          className="input mt-1 text-center text-2xl tracking-[0.5em]"
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{4,8}"
          maxLength={8}
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!/^\d{4,8}$/.test(pin)}>
            Confirm
          </button>
        </div>
      </form>
    </div>
  );
}

function TopBar({ me, onLogout }: { me: Me | null; state: State | null; onLogout: () => void }) {
  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-lg font-bold text-[var(--brand)]">
        <HandHeart size={24} aria-hidden="true" /> ApnaHaath
      </p>
      {me?.authenticated && (
        <button className="btn-ghost" onClick={onLogout}>
          <LogOut size={18} aria-hidden="true" /> Sign out
        </button>
      )}
    </header>
  );
}

type ActFn = (fn: () => Promise<unknown>, okText?: string) => Promise<void>;

function Onboarding({ me, busy, act, invite }: { me: Me; busy: boolean; act: ActFn; invite: string }) {
  const [elder, setElder] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [language, setLanguage] = useState("English");
  const [role, setRole] = useState<Role>("family");
  const [pin, setPin] = useState("");
  const [code, setCode] = useState(invite);
  const [joinPin, setJoinPin] = useState("");
  return (
    <>
      <h1 className="display mb-2 text-3xl">Welcome, {me.user?.name}</h1>
      <p className="mb-6 text-lg text-[var(--muted)]">
        Next step: create a care circle for your elder, or join one with an invite code.
      </p>
      {!!me.households?.length && (
        <section className="panel mb-6">
          <h2 className="text-xl font-semibold">Your care circles</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {me.households.map((h) => (
              <button
                key={h.id}
                className="btn-ghost"
                onClick={() =>
                  act(() =>
                    api("/api/households/select", { method: "POST", body: JSON.stringify({ householdId: h.id }) }),
                  )
                }
              >
                {h.elder_name} · {ROLE_LABEL[h.role]}
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <section className="panel">
          <h2 className="text-xl font-semibold">Create a care circle</h2>
          <form
            className="mt-3 grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              act(
                () =>
                  api("/api/households", {
                    method: "POST",
                    body: JSON.stringify({
                      elder_name: elder,
                      elder_age: age ? Number(age) : null,
                      city,
                      language,
                      role,
                      pin,
                    }),
                  }),
                "Care circle created. Next: add medicines, then invite the elder and caretaker from Care circle.",
              );
            }}
          >
            <input
              className="input"
              placeholder="Elder's name (e.g. Kamla Devi)"
              value={elder}
              onChange={(e) => setElder(e.target.value)}
              aria-label="Elder's name"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className="input"
                type="number"
                min={1}
                max={120}
                placeholder="Age (optional)"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                aria-label="Elder's age"
              />
              <input
                className="input"
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                aria-label="City"
                required
              />
            </div>
            <label className="text-sm font-semibold">
              Preferred language
              <select className="input mt-1" value={language} onChange={(e) => setLanguage(e.target.value)}>
                {["English", "Hindi", "Tamil", "Telugu", "Bengali", "Marathi", "Kannada", "Other"].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Your role
              <select className="input mt-1" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="family">Family coordinator</option>
                <option value="caretaker">Caretaker</option>
                <option value="elder">I am the elder</option>
              </select>
            </label>
            <input
              className="input"
              type="password"
              inputMode="numeric"
              pattern="\d{4,8}"
              placeholder="Choose a 4–8 digit PIN (confirms changes; asked once per 15 min)"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              aria-label="Your PIN"
              required
            />
            <button className="btn-primary" disabled={busy} type="submit">
              Create care circle
            </button>
          </form>
        </section>
        <section className="panel">
          <h2 className="text-xl font-semibold">Join with an invite code</h2>
          <p className="mt-1 text-[var(--muted)]">Your role (elder, caretaker or family) comes from the invite.</p>
          <form
            className="mt-3 grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              act(
                () => api("/api/invites/join", { method: "POST", body: JSON.stringify({ code, pin: joinPin }) }),
                "You joined the care circle.",
              );
            }}
          >
            <input
              className="input uppercase tracking-widest"
              placeholder="Invite code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-label="Invite code"
              required
            />
            <input
              className="input"
              type="password"
              inputMode="numeric"
              pattern="\d{4,8}"
              placeholder="Choose your 4–8 digit PIN"
              value={joinPin}
              onChange={(e) => setJoinPin(e.target.value)}
              aria-label="Your PIN"
              required
            />
            <button className="btn-primary" disabled={busy} type="submit">
              Join care circle
            </button>
          </form>
        </section>
      </div>
    </>
  );
}

function Dashboard({
  state,
  busy,
  act,
  withPin,
  setMsg,
  onLogout,
}: {
  state: State;
  busy: boolean;
  act: ActFn;
  withPin: (fn: (pin: string) => Promise<unknown>, ok?: string) => void;
  setMsg: (m: { text: string; ok?: boolean } | null) => void;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<Tab>("Today");
  const role = state.me.role;
  const pendingForElder = state.proposals.filter((p) => p.status === "pending");
  const go = (t: Tab) => {
    setTab(t);
    setMsg(null);
    window.scrollTo({ top: 0 });
  };
  const badge = (t: Tab) =>
    t === "Medicines" && role === "elder" && pendingForElder.length > 0 ? pendingForElder.length : 0;
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[272px_1fr]">
      <aside className="no-print sticky top-0 hidden h-screen flex-col border-r border-stone-200 bg-white px-4 py-6 lg:flex">
        <p className="flex items-center gap-2 px-2 text-lg font-bold text-[var(--brand)]">
          <HandHeart size={24} aria-hidden="true" /> ApnaHaath
        </p>
        <div className="mt-6 rounded-2xl bg-[var(--soft)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Care circle</p>
          <p className="mt-1 text-lg font-bold">{state.household.elder_name}</p>
          <p className="text-sm text-[var(--muted)]">
            You: {state.me.name} · {ROLE_LABEL[role]}
          </p>
        </div>
        <nav className="mt-6 space-y-1" aria-label="Sections">
          {TABS.map((t) => {
            const Icon = TAB_ICON[t];
            return (
              <button key={t} className="nav-item" aria-current={tab === t ? "page" : undefined} onClick={() => go(t)}>
                <Icon size={20} aria-hidden="true" /> <span className="flex-1">{t}</span>
                {badge(t) > 0 && (
                  <span className="rounded-full bg-[var(--brand-2)] px-2 text-xs font-bold text-white">{badge(t)}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3">
          <DisplayToggles />
          <button className="nav-item" onClick={onLogout}>
            <LogOut size={20} aria-hidden="true" /> Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="no-print flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 lg:hidden">
          <div>
            <p className="flex items-center gap-1.5 font-bold text-[var(--brand)]">
              <HandHeart size={20} aria-hidden="true" /> ApnaHaath
            </p>
            <p className="text-sm text-[var(--muted)]">
              {state.household.elder_name} · you are {ROLE_LABEL[role]}
            </p>
          </div>
          <button className="btn-ghost px-3" onClick={onLogout} aria-label="Sign out">
            <LogOut size={18} aria-hidden="true" />
          </button>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 pb-28 lg:px-10 lg:py-10">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">{tab}</h1>
            <p className="mt-1 text-[var(--muted)]">{TAB_SUB[tab]}</p>
          </div>
          {tab === "Today" && <Today state={state} busy={busy} withPin={withPin} setMsg={setMsg} go={go} />}
          {tab === "Medicines" && <Medicines state={state} busy={busy} withPin={withPin} />}
          {tab === "History" && (
            <>
              <WeeklySummary state={state} busy={busy} act={act} />
              <History state={state} />
            </>
          )}
          {tab === "Appointments" && <Appointments state={state} busy={busy} withPin={withPin} />}
          {tab === "Safety & AI" && <Safety state={state} busy={busy} act={act} />}
          {tab === "Care circle" && <Circle state={state} busy={busy} act={act} />}
          <AppFooter />
          <div className="mt-4 lg:hidden">
            <DisplayToggles />
          </div>
        </main>
      </div>

      <nav
        className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-stone-200 bg-white/95 backdrop-blur lg:hidden"
        aria-label="Sections"
      >
        {TABS.map((t) => {
          const Icon = TAB_ICON[t];
          return (
            <button
              key={t}
              className={`relative flex min-h-[64px] flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold ${tab === t ? "text-[var(--brand)]" : "text-[var(--muted)]"}`}
              aria-current={tab === t ? "page" : undefined}
              onClick={() => go(t)}
            >
              <Icon size={22} aria-hidden="true" />
              <span className="leading-tight">
                {t === "Appointments" ? "Visits" : t === "Care circle" ? "Circle" : t === "Safety & AI" ? "Safety" : t}
              </span>
              {badge(t) > 0 && (
                <span
                  className="absolute right-3 top-2 h-2.5 w-2.5 rounded-full bg-[var(--brand-2)]"
                  aria-label="needs your answer"
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-stone-50 p-3 text-center">
      <div className="text-3xl font-semibold">{value}</div>
      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed p-6 text-center text-[var(--muted)]">{children}</p>;
}

function Today({
  state,
  busy,
  withPin,
  setMsg,
  go,
}: {
  state: State;
  busy: boolean;
  withPin: (fn: (pin: string) => Promise<unknown>, ok?: string) => void;
  setMsg: (m: { text: string; ok?: boolean } | null) => void;
  go: (t: Tab) => void;
}) {
  const role = state.me.role;
  const [skipFor, setSkipFor] = useState<string | null>(null);
  const [med, setMed] = useState("");
  const [dose, setDose] = useState("");
  const [why, setWhy] = useState("");
  const a = state.adherence;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <section className="panel">
        <h2 className="text-2xl font-semibold">Today&apos;s medicines</h2>
        <div className="mt-4 space-y-3">
          {state.doseSlots.length === 0 && (
            <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center">
              <Pill size={36} className="mx-auto text-[var(--brand)]" aria-hidden="true" />
              <p className="mt-3 text-lg font-semibold">No medicines for today yet</p>
              <p className="mx-auto mt-1 max-w-sm text-[var(--muted)]">
                {role === "elder"
                  ? "Add your medicines, or ask family to suggest them — you accept each one."
                  : "Suggest the first medicine. The elder accepts it, then it shows up here every day."}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button className="btn-primary" onClick={() => go("Medicines")}>
                  <Pill size={18} aria-hidden="true" /> Add a medicine
                </button>
                {state.me.isOwner && (
                  <button className="btn-ghost" onClick={() => go("Care circle")}>
                    <Users size={18} aria-hidden="true" /> Invite members
                  </button>
                )}
              </div>
            </div>
          )}
          {state.doseSlots.map((slot) => (
            <article
              key={slot.id}
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
              style={{ borderLeftWidth: 8, borderLeftColor: slot.color_band }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className={role === "elder" ? "text-2xl font-bold md:text-3xl" : "text-xl font-semibold"}>
                    {slot.medicine_name}
                  </h3>
                  <p className={`text-[var(--muted)] ${role === "elder" ? "text-lg" : ""}`}>
                    {time12(slot.scheduled_at)} · {slot.instructions}
                  </p>
                  <p className="mt-2">
                    <StatusChip status={slot.status} extra={slot.skip_reason} />
                    <span className="sr-only"> ({STATUS_LABEL[slot.status] ?? slot.status})</span>
                  </p>
                </div>
                {role === "elder" && slot.status === "pending" && skipFor !== slot.id && (
                  <div className="flex w-full flex-wrap gap-3 sm:w-auto">
                    <button
                      className="btn-primary min-h-[72px] w-full px-10 text-2xl sm:w-auto"
                      disabled={busy}
                      onClick={() =>
                        withPin(
                          (pin) =>
                            api("/api/doses/confirm", {
                              method: "POST",
                              body: JSON.stringify({ doseSlotId: slot.id, pin }),
                            }),
                          "Saved: you took it.",
                        )
                      }
                    >
                      Yes, I took it
                    </button>
                    <button
                      className="btn-ghost min-h-[60px] flex-1 text-lg sm:flex-none"
                      disabled={busy}
                      onClick={() => setSkipFor(slot.id)}
                    >
                      Not now
                    </button>
                    <button
                      className="btn-ghost min-h-[60px] flex-1 text-lg sm:flex-none"
                      disabled={busy}
                      onClick={() => setMsg({ text: "Okay. This dose stays open — you can answer later.", ok: true })}
                    >
                      Later
                    </button>
                  </div>
                )}
                {role === "elder" && slot.status === "pending" && skipFor === slot.id && (
                  <div className="flex max-w-md flex-wrap gap-2">
                    <p className="w-full font-semibold">Why not now?</p>
                    {SKIP_REASONS.map((r) => (
                      <button
                        key={r}
                        className="btn-ghost"
                        disabled={busy}
                        onClick={() => {
                          setSkipFor(null);
                          withPin(
                            (pin) =>
                              api("/api/doses/skip", {
                                method: "POST",
                                body: JSON.stringify({ doseSlotId: slot.id, pin, reason: r }),
                              }),
                            "Saved. A skip is your decision — it is not counted as missed.",
                          );
                        }}
                      >
                        {r}
                      </button>
                    ))}
                    <button className="btn-ghost" onClick={() => setSkipFor(null)}>
                      Back
                    </button>
                  </div>
                )}
                {role === "caretaker" && (
                  <button
                    className="btn-accent"
                    disabled={busy}
                    onClick={() =>
                      withPin(
                        (pin) =>
                          api("/api/doses/witness", {
                            method: "POST",
                            body: JSON.stringify({ doseSlotId: slot.id, pin }),
                          }),
                        "Saved as witnessed. Only the elder can mark it as taken.",
                      )
                    }
                  >
                    I saw her take it
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      <div className="space-y-6">
        <section className="panel">
          <h2 className="text-xl font-semibold">Today at a glance</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Confirmed by elder" value={a.elderConfirmed} />
            <Stat label="Witnessed" value={a.witnessed} />
            <Stat label="Skipped" value={a.skipped} />
            <Stat label="Missed / not confirmed" value={a.missed} />
          </div>
          <div className="mt-3">
            <Stat
              label="Elder-confirmation rate"
              value={a.elderConfirmationRate == null ? "—" : `${a.elderConfirmationRate}%`}
            />
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Rate = confirmed ÷ (confirmed + missed). Skips are her decision, not failures. A witness never counts as
            taken.
          </p>
        </section>
        {role === "elder" && (
          <section className="panel">
            <h2 className="text-xl font-semibold">I took it myself</h2>
            <p className="text-sm text-[var(--muted)]">
              Took something that is not on your list? Write it here so your family and doctor know.
            </p>
            <div className="mt-3 grid gap-2">
              <input
                className="input"
                placeholder="Medicine name (e.g. Brufen)"
                value={med}
                onChange={(e) => setMed(e.target.value)}
                aria-label="Medicine name"
              />
              <input
                className="input"
                placeholder="How much (e.g. 400 mg)"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                aria-label="How much"
              />
              <input
                className="input"
                placeholder="Why (e.g. knee pain)"
                value={why}
                onChange={(e) => setWhy(e.target.value)}
                aria-label="Why"
              />
              <button
                className="btn-primary"
                disabled={busy || !med}
                onClick={() =>
                  withPin(
                    (pin) =>
                      api("/api/doses/self-add", {
                        method: "POST",
                        body: JSON.stringify({ pin, medicineName: med, dose, reason: why, generateCard: true }),
                      }),
                    "Saved. A safety note was added under Safety.",
                  )
                }
              >
                Save and check safety
              </button>
            </div>
          </section>
        )}
        {state.appointments[0] && (
          <section className="panel">
            <h2 className="text-xl font-semibold">Next appointment</h2>
            <p className="mt-2 text-lg">
              <strong>{state.appointments[0].doctor}</strong> — {state.appointments[0].place}
            </p>
            <p className="text-[var(--muted)]">
              {dayLabel(state.appointments[0].scheduled_at)}, {time12(state.appointments[0].scheduled_at)} IST
            </p>
            <AddToGoogleCalendar appointment={state.appointments[0]} elderName={state.household.elder_name} />
          </section>
        )}
      </div>
    </div>
  );
}

function describeProposal(p: State["proposals"][number], meds: State["medicines"]) {
  let pl: Record<string, string> = {};
  try {
    pl = JSON.parse(p.payload_json);
  } catch {
    /* ignore */
  }
  const name = meds.find((m) => m.id === p.medicine_id)?.name ?? pl.name ?? "a medicine";
  if (p.kind === "add")
    return `Add ${name}${pl.dose ? ` (${pl.dose})` : ""} at ${pl.schedule_time ? formatTime12(pl.schedule_time) : ""}${pl.instructions ? ` — ${pl.instructions}` : ""}`;
  if (p.kind === "edit_schedule") return `Move ${name} to ${pl.schedule_time ? formatTime12(pl.schedule_time) : ""}`;
  if (p.kind === "stop") return `Stop ${name}${pl.reason ? ` — ${pl.reason}` : ""}`;
  return p.kind;
}

function Medicines({
  state,
  busy,
  withPin,
}: {
  state: State;
  busy: boolean;
  withPin: (fn: (pin: string) => Promise<unknown>, ok?: string) => void;
}) {
  const role = state.me.role;
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [time, setTime] = useState("09:00");
  const [instr, setInstr] = useState("");
  const [moveTime, setMoveTime] = useState<Record<string, string>>({});
  const active = state.medicines.filter((m) => m.active);
  const pending = state.proposals.filter((p) => p.status === "pending");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="panel">
        <h2 className="text-2xl font-semibold">Medicine list</h2>
        <div className="mt-3 space-y-2">
          {active.length === 0 && <Empty>No medicines yet.</Empty>}
          {active.map((m) => (
            <div
              key={m.id}
              className="rounded-xl border bg-white p-3"
              style={{ borderLeftWidth: 8, borderLeftColor: m.color_band }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">
                    {m.name} <span className="font-normal text-[var(--muted)]">{m.dose}</span>
                  </p>
                  <p className="text-[var(--muted)]">
                    {formatTime12(m.schedule_time)} · {m.instructions}
                  </p>
                </div>
                {role === "family" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <TimeField
                      className="input w-40"
                      value={moveTime[m.id] ?? m.schedule_time}
                      onChange={(v) => setMoveTime({ ...moveTime, [m.id]: v })}
                      label={`New time for ${m.name}`}
                    />
                    <button
                      className="btn-ghost"
                      disabled={busy}
                      onClick={() =>
                        withPin(
                          (pin) =>
                            api("/api/proposals", {
                              method: "POST",
                              body: JSON.stringify({
                                pin,
                                kind: "edit_schedule",
                                medicineId: m.id,
                                payload: { schedule_time: moveTime[m.id] ?? m.schedule_time },
                              }),
                            }),
                          "Suggestion sent. It changes only when the elder says yes.",
                        )
                      }
                    >
                      Suggest time
                    </button>
                    <button
                      className="btn-ghost"
                      disabled={busy}
                      onClick={() =>
                        withPin(
                          (pin) =>
                            api("/api/proposals", {
                              method: "POST",
                              body: JSON.stringify({
                                pin,
                                kind: "stop",
                                medicineId: m.id,
                                payload: { reason: "Discuss with the doctor" },
                              }),
                            }),
                          "Suggestion sent.",
                        )
                      }
                    >
                      Suggest stop
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="space-y-6">
        {role === "elder" && (
          <section className="panel">
            <h2 className="text-2xl font-semibold">Suggestions for you</h2>
            {pending.length === 0 && <Empty>No suggestions waiting.</Empty>}
            {pending.map((p) => (
              <div key={p.id} className="mt-3 rounded-xl border bg-white p-4">
                <p className="text-lg">{describeProposal(p, state.medicines)}</p>
                <p className="text-sm text-[var(--muted)]">Suggested by {p.created_by}. Is this okay with you?</p>
                <div className="mt-3 flex gap-2">
                  <button
                    className="btn-primary"
                    disabled={busy}
                    onClick={() =>
                      withPin(
                        (pin) =>
                          api("/api/proposals", {
                            method: "PATCH",
                            body: JSON.stringify({ pin, proposalId: p.id, decision: "accept" }),
                          }),
                        "Done. Your list is updated.",
                      )
                    }
                  >
                    Yes, okay
                  </button>
                  <button
                    className="btn-ghost"
                    disabled={busy}
                    onClick={() =>
                      withPin(
                        (pin) =>
                          api("/api/proposals", {
                            method: "PATCH",
                            body: JSON.stringify({ pin, proposalId: p.id, decision: "reject" }),
                          }),
                        "Okay. Nothing was changed.",
                      )
                    }
                  >
                    No
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}
        {role === "family" && (
          <section className="panel">
            <h2 className="text-2xl font-semibold">Suggest a new medicine</h2>
            <p className="text-sm text-[var(--muted)]">
              It is added only after the elder says yes. Thyronorm and Shelcal must be 4+ hours apart (fixed rule).
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <input
                className="input"
                placeholder="Name (e.g. Telma 40)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label="Medicine name"
              />
              <input
                className="input"
                placeholder="Dose (e.g. 40 mg)"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                aria-label="Dose"
              />
              <TimeField value={time} onChange={setTime} label="Time" />
              <input
                className="input"
                placeholder="Instructions (e.g. after breakfast)"
                value={instr}
                onChange={(e) => setInstr(e.target.value)}
                aria-label="Instructions"
              />
            </div>
            <button
              className="btn-primary mt-3"
              disabled={busy || !name}
              onClick={() =>
                withPin(
                  (pin) =>
                    api("/api/proposals", {
                      method: "POST",
                      body: JSON.stringify({
                        pin,
                        kind: "add",
                        payload: { name, dose, schedule_time: time, instructions: instr },
                      }),
                    }),
                  "Suggestion sent to the elder.",
                )
              }
            >
              Send suggestion
            </button>
          </section>
        )}
        <section className="panel">
          <h2 className="text-xl font-semibold">All suggestions</h2>
          {state.proposals.length === 0 && <Empty>None yet.</Empty>}
          <ul className="mt-2 space-y-1">
            {state.proposals.map((p) => (
              <li key={p.id} className="flex justify-between gap-2 border-b py-1 text-sm">
                <span>{describeProposal(p, state.medicines)}</span>
                <span className="font-semibold">
                  {p.status === "pending" ? "Waiting for elder" : p.status === "accepted" ? "Accepted" : "Declined"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

type Weekly = {
  summary: { elder: string; caretaker: string; family: string };
  source: string;
  disclaimer: string;
  stats: { rate: number | null; confirmed: number; missed: number; skipped: number; witnessed: number };
};

function WeeklySummary({ state, busy, act }: { state: State; busy: boolean; act: ActFn }) {
  const [w, setW] = useState<Weekly | null>(null);
  const role = state.me.role;
  const text = w
    ? role === "family"
      ? w.summary.family
      : role === "caretaker"
        ? w.summary.caretaker
        : w.summary.elder
    : "";
  return (
    <section className="panel mb-6" aria-labelledby="weekly-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="weekly-h" className="text-2xl font-semibold">
          This week, in plain words
        </h2>
        <button
          className="btn-primary"
          disabled={busy}
          onClick={() => act(async () => setW((await api("/api/summary/weekly", { method: "POST" })) as Weekly))}
        >
          {w ? "Refresh weekly summary" : "Get weekly care summary (AI)"}
        </button>
      </div>
      <p className="text-sm text-[var(--muted)]">
        Numbers come from the log. Adaption only words them for {role === "elder" ? "you" : `the ${role}`}; it can never
        change a medicine.
      </p>
      {w && (
        <div className="mt-3">
          <p className="mb-2 text-sm">
            <span className="rounded-full bg-stone-100 px-2 py-0.5">
              source: {w.source === "adaption" ? "Adaption" : "template fallback"}
            </span>{" "}
            {w.stats.rate !== null && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-900">
                Elder-confirmation rate {w.stats.rate}%
              </span>
            )}
          </p>
          <p className={`whitespace-pre-line ${role === "elder" ? "text-2xl leading-relaxed" : "text-lg"}`}>{text}</p>
          <p className="mt-3 text-xs text-[var(--muted)]">{w.disclaimer}</p>
          <div className="mt-3">
            <ShareButtons text={`ApnaHaath weekly summary\n\n${text}\n\n${w.disclaimer}`} label="weekly summary" />
          </div>
        </div>
      )}
    </section>
  );
}

function lastSevenIstDays(): string[] {
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const base = new Date(`${today}T12:00:00Z`).getTime();
  return Array.from({ length: 7 }, (_, i) => new Date(base - i * 86_400_000).toISOString().slice(0, 10));
}

function History({ state }: { state: State }) {
  const byDay = new Map<string, Slot[]>(lastSevenIstDays().map((d) => [d, [] as Slot[]]));
  for (const s of state.history) {
    const d = s.scheduled_at.slice(0, 10);
    byDay.set(d, [...(byDay.get(d) ?? []), s]);
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="panel">
        <h2 className="text-2xl font-semibold">Last 7 days</h2>
        <p className="text-sm text-[var(--muted)]">
          Days before the care circle started, or with no medicines due, show as “no doses”.
        </p>
        {[...byDay.entries()]
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([day, slots]) => (
            <div key={day} className="mt-4">
              <h3 className="font-semibold">{dayLabel(day)}</h3>
              {slots.length === 0 && (
                <p className="mt-1 rounded-lg border border-dashed bg-white/60 px-3 py-2 text-[var(--muted)]">
                  No doses
                </p>
              )}
              <ul className="mt-1 grid gap-1">
                {slots
                  .sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))
                  .map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded-lg border bg-white px-3 py-2">
                      <span>
                        {time12(s.scheduled_at)} · {s.medicine_name}
                      </span>
                      <StatusChip status={s.status} extra={s.skip_reason} />
                    </li>
                  ))}
              </ul>
            </div>
          ))}
      </section>
      <section className="panel">
        <h2 className="text-2xl font-semibold">Who did what</h2>
        <p className="text-sm text-[var(--muted)]">Every entry is kept. Nothing is edited or deleted.</p>
        {state.events.length === 0 && <Empty>Nothing yet.</Empty>}
        <ul className="mt-3 space-y-2">
          {state.events.map((e) => (
            <li key={e.id} className="border-b pb-2">
              <span className="text-sm text-[var(--muted)]">
                {dayLabel(e.created_at)} {time12(e.created_at)}
              </span>
              <br />
              <strong>{e.actor_name}</strong> {EVENT_LABEL[e.type] ?? e.type}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function AddToGoogleCalendar({
  appointment,
  elderName,
}: {
  appointment: State["appointments"][number];
  elderName: string;
}) {
  const href = googleCalendarUrl({
    title: `${appointment.doctor} — ${elderName}`,
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

function Appointments({
  state,
  busy,
  withPin,
}: {
  state: State;
  busy: boolean;
  withPin: (fn: (pin: string) => Promise<unknown>, ok?: string) => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [doctor, setDoctor] = useState("");
  const [place, setPlace] = useState("");
  const [when, setWhen] = useState("");
  const family = state.me.role === "family";
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="panel">
        <h2 className="text-2xl font-semibold">Appointments</h2>
        {state.appointments.length === 0 && <Empty>No appointments yet.</Empty>}
        <ul className="mt-3 space-y-2">
          {state.appointments.map((a) => (
            <li key={a.id} className="rounded-xl border bg-white p-3">
              <strong>{a.doctor}</strong> — {a.place}
              <div className="text-[var(--muted)]">
                {dayLabel(a.scheduled_at)}, {time12(a.scheduled_at)} IST
              </div>
              {a.notes && <div className="text-sm">{a.notes}</div>}
              <AddToGoogleCalendar appointment={a} elderName={state.household.elder_name} />
              {family && (
                <button
                  className="btn-ghost mt-2"
                  onClick={() => {
                    setEditId(a.id);
                    setDoctor(a.doctor);
                    setPlace(a.place);
                    setWhen(a.scheduled_at.slice(0, 16));
                  }}
                >
                  Edit
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
      {family && (
        <section className="panel">
          <h2 className="text-2xl font-semibold">{editId ? "Edit appointment" : "Add appointment"}</h2>
          <div className="mt-3 grid gap-2">
            <input
              className="input"
              placeholder="Doctor"
              value={doctor}
              onChange={(e) => setDoctor(e.target.value)}
              aria-label="Doctor"
            />
            <input
              className="input"
              placeholder="Place"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              aria-label="Place"
            />
            <TimeField type="datetime-local" value={when} onChange={setWhen} label="Date and time (IST)" />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              className="btn-primary"
              disabled={busy || !doctor || !place || !when}
              onClick={() =>
                withPin(
                  (pin) =>
                    api("/api/appointments", {
                      method: "POST",
                      body: JSON.stringify({
                        pin,
                        doctor,
                        place,
                        scheduled_at: when,
                        ...(editId ? { id: editId } : {}),
                      }),
                    }).then(() => {
                      setEditId(null);
                      setDoctor("");
                      setPlace("");
                      setWhen("");
                    }),
                  "Appointment saved.",
                )
              }
            >
              {busy ? "Saving…" : editId ? "Save changes" : "Add appointment"}
            </button>
            {editId && (
              <button
                className="btn-ghost"
                disabled={busy}
                onClick={() => {
                  setEditId(null);
                  setDoctor("");
                  setPlace("");
                  setWhen("");
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/** Copy a care message, share it with the native share sheet (when available), or open WhatsApp. */
function ShareButtons({ text, label = "message" }: { text: string; label?: string }) {
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

function Safety({ state, busy, act }: { state: State; busy: boolean; act: ActFn }) {
  const role = state.me.role;
  const [brief, setBrief] = useState("");
  const [msgs, setMsgs] = useState<
    Record<string, { messages: { elder: string; caretaker: string; family: string }; source: string }>
  >({});
  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-semibold">Safety notes</h2>
          <button
            className="btn-ghost"
            disabled={busy}
            onClick={() =>
              act(
                () =>
                  api("/api/cards/generate", {
                    method: "POST",
                    body: JSON.stringify({ context: "Weekly safety review of the current list" }),
                  }),
                "New safety note added.",
              )
            }
          >
            Check the list with Gemini
          </button>
        </div>
        <p className="text-sm text-[var(--muted)]">
          Gemini can only warn. Any answer that tries to change a dose is thrown away.
        </p>
        {state.cards.length === 0 && <Empty>No safety notes yet.</Empty>}
        <div className="mt-3 space-y-4">
          {state.cards.map((c) => (
            <article key={c.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <p className="text-sm uppercase tracking-wide text-amber-800">
                {c.severity === "review_required"
                  ? "Needs a doctor's review"
                  : c.severity === "urgent_review"
                    ? "Talk to a doctor soon"
                    : "For information"}
              </p>
              <h3 className="text-lg font-semibold">{c.title}</h3>
              {c.created_at && (
                <p className="text-xs text-[var(--muted)]">
                  Added {dayLabel(c.created_at)}, {time12(c.created_at)} IST
                </p>
              )}
              <p className="mt-2 text-lg">
                {role === "family" ? c.family_line_en : role === "caretaker" ? c.caretaker_line_hi : c.elder_line_hi}
              </p>
              <p className="mt-2 text-sm">
                <strong>Tell the doctor:</strong> {c.tell_doctor}
              </p>
              <p className="mt-2 text-sm font-semibold text-[var(--danger)]">{c.emergency_line}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{c.disclaimer}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="btn-ghost"
                  onClick={() => {
                    const u = new SpeechSynthesisUtterance(
                      role === "family"
                        ? c.family_line_en
                        : role === "caretaker"
                          ? c.caretaker_line_hi
                          : c.elder_line_hi,
                    );
                    u.lang = "en-IN";
                    window.speechSynthesis.cancel();
                    window.speechSynthesis.speak(u);
                  }}
                >
                  Read aloud
                </button>
                <button
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      const r = await api("/api/cards/messages", {
                        method: "POST",
                        body: JSON.stringify({ cardId: c.id }),
                      });
                      setMsgs((m) => ({ ...m, [c.id]: r }));
                    })
                  }
                >
                  Generate with Adaption
                </button>
              </div>
              {msgs[c.id] && (
                <div className="mt-3 rounded-xl border bg-white p-3">
                  <p className="font-semibold">
                    Messages for the care circle (via Adaption){" "}
                    <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs">
                      source: {msgs[c.id].source === "adaption" ? "Adaption" : "template fallback"}
                    </span>
                  </p>
                  <p className="mt-2">
                    <strong>For {state.household.elder_name.split(" ")[0]}:</strong> {msgs[c.id].messages.elder}
                  </p>
                  <p className="mt-1">
                    <strong>For the caretaker:</strong> {msgs[c.id].messages.caretaker}
                  </p>
                  <pre className="mt-1 whitespace-pre-wrap font-sans">
                    <strong>For family:</strong> {msgs[c.id].messages.family}
                  </pre>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
      <div className="space-y-6">
        <section className="panel">
          <h2 className="text-xl font-semibold">Doctor brief</h2>
          <p className="text-sm text-[var(--muted)]">A short summary of the week to show at the clinic.</p>
          <button
            className="btn-primary mt-3"
            disabled={busy}
            onClick={() => act(async () => setBrief((await api("/api/brief", { method: "POST" })).brief))}
          >
            Make doctor brief
          </button>
          {brief && (
            <>
              <div className="print-memo mt-3 rounded-xl bg-stone-100 p-3">
                <p className="print-only text-sm font-semibold uppercase tracking-[0.2em]">ApnaHaath · Doctor memo</p>
                <p className="print-only mb-2 text-sm">
                  For {state.household.elder_name}
                  {state.household.elder_age ? `, ${state.household.elder_age}` : ""} · {state.household.city} · printed{" "}
                  {new Date().toLocaleDateString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                <pre className="whitespace-pre-wrap font-sans text-sm">{brief}</pre>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn-primary no-print" onClick={() => window.print()}>
                  Print doctor memo
                </button>
                <ShareButtons text={brief} label="doctor memo" />
              </div>
            </>
          )}
        </section>
        {role === "family" && (
          <section className="panel">
            <h2 className="text-xl font-semibold">Email reminders</h2>
            <p className="text-sm text-[var(--muted)]">
              Upcoming doses, missed doses (never skips) and appointments. Each reminder is sent once.
            </p>
            <p className="mt-1 rounded-lg bg-stone-100 px-3 py-2 text-sm">
              Reminders (upcoming dose, missed dose, appointment) are emailed to family members — and the elder gets her
              own one-tap “I took it” link. Each is also kept in the list below with its email status.
            </p>
            <button
              className="btn-ghost mt-3"
              disabled={busy}
              onClick={() => act(() => api("/api/reminders/run", { method: "POST" }), "Reminder check finished.")}
            >
              Run reminder check now
            </button>
            {state.outbox.length === 0 && <p className="mt-2 text-sm text-[var(--muted)]">No emails yet.</p>}
            <ul className="mt-2 space-y-1 text-sm">
              {state.outbox.map((o) => (
                <li key={o.id} className="border-b py-2">
                  <p>
                    {o.subject} → {o.to_email}{" "}
                    <span
                      className={`ml-1 rounded-full px-2 py-0.5 text-xs ${o.status === "sent" ? "bg-emerald-100 text-emerald-900" : o.status === "failed" ? "bg-red-100 text-red-800" : "bg-stone-100 text-stone-700"}`}
                    >
                      {o.status === "mock"
                        ? "in-app only"
                        : o.status === "sent"
                          ? "emailed"
                          : o.status === "failed"
                            ? "email failed"
                            : o.status === "pending"
                              ? "queued"
                              : o.status}
                    </span>{" "}
                    <span className="text-xs text-[var(--muted)]">
                      {dayLabel(o.created_at)} {time12(o.created_at)}
                    </span>
                  </p>
                  {o.body && (
                    <div className="mt-1">
                      <ShareButtons text={`${o.subject}\n\n${o.body}`} label="reminder" />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function Circle({ state, busy, act }: { state: State; busy: boolean; act: ActFn }) {
  const [last, setLast] = useState<{ code: string; link: string; role: Role; expiresAt: string } | null>(null);
  const hasElder = state.members.some((m) => m.role === "elder");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="panel">
        <h2 className="text-2xl font-semibold">People in this care circle</h2>
        <p className="text-[var(--muted)]">
          {state.household.elder_name}
          {state.household.elder_age ? `, ${state.household.elder_age}` : ""} · {state.household.city} · prefers{" "}
          {state.household.language}
        </p>
        <ul className="mt-3 space-y-2">
          {state.members.map((m) => (
            <li key={m.id} className="rounded-xl border bg-white px-3 py-2">
              <strong>{m.name}</strong> — {ROLE_LABEL[m.role]}
            </li>
          ))}
        </ul>
        {!hasElder && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
            Next step: invite the elder so she can accept medicines and confirm doses.
          </p>
        )}
      </section>
      {state.me.isOwner ? (
        <section className="panel">
          <h2 className="text-2xl font-semibold">Invite someone</h2>
          <p className="text-sm text-[var(--muted)]">
            Each code works once and expires in 48 hours. Share it privately.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["elder", "caretaker", "family"] as Role[]).map((r) => (
              <button
                key={r}
                className="btn-ghost"
                disabled={busy || (r === "elder" && hasElder)}
                onClick={() =>
                  act(async () =>
                    setLast(await api("/api/invites", { method: "POST", body: JSON.stringify({ role: r }) })),
                  )
                }
              >
                Invite {ROLE_LABEL[r].toLowerCase()}
              </button>
            ))}
          </div>
          {last && (
            <div className="mt-4 rounded-xl border-2 border-[var(--brand)] bg-white p-4">
              <p>
                Invite code for <strong>{ROLE_LABEL[last.role]}</strong> (shown only once):
              </p>
              <p className="my-2 font-mono text-3xl tracking-widest">{last.code}</p>
              <p className="break-all text-sm">Link: {last.link}</p>
              <div className="mt-2">
                <ShareButtons
                  text={`You're invited to ${state.household.elder_name}'s care circle on ApnaHaath as ${ROLE_LABEL[last.role]}. Open ${last.link} (code ${last.code}, works once, expires in 48 hours).`}
                  label="invite"
                />
              </div>
            </div>
          )}
          <h3 className="mt-4 font-semibold">Recent invites</h3>
          {state.invites.length === 0 && <p className="text-sm text-[var(--muted)]">None yet.</p>}
          <ul className="text-sm">
            {state.invites.map((i) => (
              <li key={i.id} className="border-b py-1">
                {ROLE_LABEL[i.role]} ·{" "}
                {i.used_by ? "used" : Date.parse(i.expires_at) < Date.now() ? "expired" : "waiting"}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="panel">
          <Empty>Only the person who created this care circle can invite others.</Empty>
        </section>
      )}
    </div>
  );
}
