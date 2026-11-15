"use client";

import { useCallback, useEffect, useState } from "react";

type Role = "elder" | "caretaker" | "family";
type Me = { authenticated: boolean; user?: { id: string; name: string; email: string; is_demo: number }; households?: Array<{ id: string; elder_name: string; city: string; is_demo: number; role: Role }>; activeHouseholdId?: string | null };
type Slot = { id: string; medicine_id: string; medicine_name: string; brand_hi: string; color_band: string; instructions: string; scheduled_at: string; status: string; skip_reason: string | null };
type Card = { id: string; severity: string; title: string; elder_line_hi: string; caretaker_line_hi: string; family_line_en: string; tell_doctor: string; disclaimer: string; emergency_line: string; created_at: string };
type State = {
  me: { id: string; name: string; email: string; role: Role; isOwner: boolean };
  household: { id: string; elder_name: string; elder_age: number | null; city: string; language: string; is_demo: number };
  demoCredentials: Array<{ role: Role; name: string; email: string; password: string; pin: string }> | null;
  members: Array<{ id: string; name: string; role: Role }>;
  medicines: Array<{ id: string; name: string; dose: string; schedule_time: string; instructions: string; color_band: string; active: number }>;
  doseSlots: Slot[];
  history: Slot[];
  appointments: Array<{ id: string; doctor: string; place: string; scheduled_at: string; notes: string | null }>;
  events: Array<{ id: string; type: string; actor_name: string; actor_role: string; created_at: string; payload_json: string }>;
  cards: Card[];
  proposals: Array<{ id: string; kind: string; medicine_id: string | null; payload_json: string; status: string; created_by: string; created_at: string }>;
  outbox: Array<{ id: string; kind: string; to_email: string; subject: string; status: string; created_at: string }>;
  adherence: { elderConfirmed: number; witnessed: number; skipped: number; missed: number; pending: number; elderConfirmationRate: number | null };
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
const TABS = ["Today", "Medicines", "History", "Appointments", "Safety", "Care circle"] as const;
type Tab = (typeof TABS)[number];

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function time12(iso: string) {
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}
function dayLabel(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00+05:30`);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

export default function CareApp() {
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState("");

  const refresh = useCallback(async () => {
    const m = (await api("/api/auth/me")) as Me;
    setMe(m);
    if (m.authenticated && m.activeHouseholdId) setState((await api("/api/state")) as State);
    else setState(null);
  }, []);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("invite");
    if (code) setInvite(code);
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

  /** Every authoring action asks for the member's personal PIN again. */
  function withPin(fn: (pin: string) => Promise<unknown>, okText?: string) {
    const pin = window.prompt("Enter your PIN to confirm");
    if (!pin) return;
    return act(() => fn(pin), okText);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 pb-24">
      <TopBar me={me} state={state} onLogout={() => act(() => api("/api/auth/logout", { method: "POST" }))} />
      {msg && (
        <p role="status" className={`mb-4 rounded-xl border px-4 py-3 ${msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}>
          {msg.text}
        </p>
      )}
      {!me ? (
        <p className="py-16 text-lg">Loading…</p>
      ) : !me.authenticated ? (
        <Landing busy={busy} act={act} invite={invite} />
      ) : !state ? (
        <Onboarding me={me} busy={busy} act={act} invite={invite} />
      ) : (
        <Dashboard state={state} busy={busy} act={act} withPin={withPin} setMsg={setMsg} />
      )}
      <footer className="mt-10 border-t pt-4 text-sm text-[var(--muted)]">
        <p className="font-semibold text-[var(--danger)]">Emergency: call 108 or go to the nearest hospital.</p>
        <p>ApnaHaath is a care log. It is not a doctor and does not start, stop or change medicines. Talk to a qualified doctor or pharmacist.</p>
      </footer>
    </main>
  );
}

function TopBar({ me, state, onLogout }: { me: Me | null; state: State | null; onLogout: () => void }) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">ApnaHaath</p>
        {state && (
          <p className="text-lg">
            Care circle for <strong>{state.household.elder_name}</strong> · you are <strong>{state.me.name}</strong> ({ROLE_LABEL[state.me.role]})
          </p>
        )}
      </div>
      {me?.authenticated && (
        <button className="btn-ghost" onClick={onLogout}>
          Sign out
        </button>
      )}
    </header>
  );
}

type ActFn = (fn: () => Promise<unknown>, okText?: string) => Promise<void>;

function Landing({ busy, act, invite }: { busy: boolean; act: ActFn; invite: string }) {
  const [mode, setMode] = useState<"signup" | "login">(invite ? "signup" : "signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <>
      <section className="mb-8 grid gap-6 md:grid-cols-[1.3fr_1fr] md:items-center">
        <div>
          <h1 className="display text-4xl leading-tight md:text-5xl">
            Dawai unke haath se.
            <span className="block text-[var(--brand-2)]">Log unke naam se.</span>
          </h1>
          <p className="mt-2 text-lg italic text-[var(--muted)]">Medicine from her hand. The log in her name.</p>
          <p className="mt-4 max-w-xl text-lg">
            A shared medicine log for an elder, her caretaker and her family. Only the elder can mark a dose as taken. Family can suggest changes, but nothing changes until she says yes. AI can warn — it can never change a prescription.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn-accent" disabled={busy} onClick={() => act(() => api("/api/demo/start", { method: "POST" }), "Demo care circle ready. You are signed in as Priya (family). Use the buttons above to view as Kamla or Sunita.")}>
              Try the demo household
            </button>
            <a className="btn-ghost" href="#account">Create your own care circle</a>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)]">The demo creates a fresh, private copy with a fictional patient (Kamla Devi Shukla, 74, Lucknow).</p>
        </div>
        <ol className="panel space-y-3 text-base">
          <li><strong>1. Sign up</strong> with your name, email and a password.</li>
          <li><strong>2. Create a care circle</strong> for your elder and set your PIN.</li>
          <li><strong>3. Invite</strong> the elder, the caretaker and other family with one-time codes.</li>
          <li><strong>4. Suggest medicines.</strong> The elder accepts, then confirms each dose herself.</li>
        </ol>
      </section>

      <section id="account" className="panel mx-auto max-w-xl">
        <div className="mb-4 flex gap-2">
          <button className={mode === "signup" ? "btn-primary" : "btn-ghost"} onClick={() => setMode("signup")}>Sign up</button>
          <button className={mode === "login" ? "btn-primary" : "btn-ghost"} onClick={() => setMode("login")}>Sign in</button>
        </div>
        {invite && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">You have an invite code. Sign up or sign in first, then you can join.</p>}
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            act(() => api(mode === "signup" ? "/api/auth/signup" : "/api/auth/login", { method: "POST", body: JSON.stringify(mode === "signup" ? { name, email, password } : { email, password }) }));
          }}
        >
          {mode === "signup" && <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Your name" required />}
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" required />
          <input className="input" type="password" placeholder={mode === "signup" ? "Password (at least 8 characters)" : "Password"} value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Password" required minLength={mode === "signup" ? 8 : 1} />
          <button className="btn-primary" disabled={busy} type="submit">{mode === "signup" ? "Create account" : "Sign in"}</button>
        </form>
      </section>
    </>
  );
}

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
      <p className="mb-6 text-lg text-[var(--muted)]">Next step: create a care circle for your elder, or join one with an invite code.</p>
      {!!me.households?.length && (
        <section className="panel mb-6">
          <h2 className="text-xl font-semibold">Your care circles</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {me.households.map((h) => (
              <button key={h.id} className="btn-ghost" onClick={() => act(() => api("/api/households/select", { method: "POST", body: JSON.stringify({ householdId: h.id }) }))}>
                {h.elder_name} · {ROLE_LABEL[h.role]}{h.is_demo ? " · demo" : ""}
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <section className="panel">
          <h2 className="text-xl font-semibold">Create a care circle</h2>
          <form className="mt-3 grid gap-3" onSubmit={(e) => { e.preventDefault(); act(() => api("/api/households", { method: "POST", body: JSON.stringify({ elder_name: elder, elder_age: age ? Number(age) : null, city, language, role, pin }) }), "Care circle created. Next: invite the elder and caretaker from the Care circle tab."); }}>
            <input className="input" placeholder="Elder's name (e.g. Kamla Devi)" value={elder} onChange={(e) => setElder(e.target.value)} aria-label="Elder's name" required />
            <div className="grid grid-cols-2 gap-3">
              <input className="input" type="number" min={40} max={120} placeholder="Age" value={age} onChange={(e) => setAge(e.target.value)} aria-label="Elder's age" />
              <input className="input" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} aria-label="City" required />
            </div>
            <label className="text-sm font-semibold">Language she prefers
              <select className="input mt-1" value={language} onChange={(e) => setLanguage(e.target.value)}>
                {["English", "Hindi", "Tamil", "Telugu", "Bengali", "Marathi", "Kannada", "Other"].map((l) => <option key={l}>{l}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">Your role
              <select className="input mt-1" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="family">Family coordinator</option>
                <option value="caretaker">Caretaker</option>
                <option value="elder">I am the elder</option>
              </select>
            </label>
            <input className="input" type="password" inputMode="numeric" pattern="\d{4,8}" placeholder="Choose a 4–8 digit PIN (asked before every change)" value={pin} onChange={(e) => setPin(e.target.value)} aria-label="Your PIN" required />
            <button className="btn-primary" disabled={busy} type="submit">Create care circle</button>
          </form>
        </section>
        <section className="panel">
          <h2 className="text-xl font-semibold">Join with an invite code</h2>
          <p className="mt-1 text-[var(--muted)]">Your role (elder, caretaker or family) comes from the invite.</p>
          <form className="mt-3 grid gap-3" onSubmit={(e) => { e.preventDefault(); act(() => api("/api/invites/join", { method: "POST", body: JSON.stringify({ code, pin: joinPin }) }), "You joined the care circle."); }}>
            <input className="input uppercase tracking-widest" placeholder="Invite code" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Invite code" required />
            <input className="input" type="password" inputMode="numeric" pattern="\d{4,8}" placeholder="Choose your 4–8 digit PIN" value={joinPin} onChange={(e) => setJoinPin(e.target.value)} aria-label="Your PIN" required />
            <button className="btn-primary" disabled={busy} type="submit">Join care circle</button>
          </form>
        </section>
      </div>
    </>
  );
}

function Dashboard({ state, busy, act, withPin, setMsg }: { state: State; busy: boolean; act: ActFn; withPin: (fn: (pin: string) => Promise<unknown>, ok?: string) => void; setMsg: (m: { text: string; ok?: boolean } | null) => void }) {
  const [tab, setTab] = useState<Tab>("Today");
  const role = state.me.role;
  const pendingForElder = state.proposals.filter((p) => p.status === "pending");
  return (
    <>
      {state.demoCredentials && (
        <section className="panel mb-6 border-amber-300 bg-amber-50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-amber-900">Demo care circle (fictional patient). These logins work only for this demo copy.</p>
              <p className="text-sm text-amber-900">View the app as:</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["elder", "caretaker", "family"] as Role[]).map((r) => (
                <button key={r} className={role === r ? "btn-primary" : "btn-ghost"} disabled={busy || role === r} onClick={() => act(() => api("/api/demo/switch", { method: "POST", body: JSON.stringify({ role: r }) }), `Now viewing as ${ROLE_LABEL[r]}.`)}>
                  {state.demoCredentials?.find((c) => c.role === r)?.name.split(" ")[0]} ({ROLE_LABEL[r]})
                </button>
              ))}
            </div>
          </div>
          <details className="mt-2 text-sm text-amber-900">
            <summary className="cursor-pointer">Show demo logins and PINs</summary>
            <ul className="mt-2 grid gap-1 md:grid-cols-3">
              {state.demoCredentials.map((c) => (
                <li key={c.role}><strong>{c.name}</strong> ({ROLE_LABEL[c.role]})<br />{c.email}<br />password <code>{c.password}</code> · PIN <code>{c.pin}</code></li>
              ))}
            </ul>
          </details>
        </section>
      )}

      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? "btn-primary" : "btn-ghost"} onClick={() => setTab(t)}>
            {t}
            {t === "Medicines" && role === "elder" && pendingForElder.length > 0 ? ` (${pendingForElder.length})` : ""}
          </button>
        ))}
      </nav>

      {tab === "Today" && <Today state={state} busy={busy} withPin={withPin} setMsg={setMsg} />}
      {tab === "Medicines" && <Medicines state={state} busy={busy} withPin={withPin} />}
      {tab === "History" && <><WeeklySummary state={state} busy={busy} act={act} /><History state={state} /></>}
      {tab === "Appointments" && <Appointments state={state} busy={busy} withPin={withPin} />}
      {tab === "Safety" && <Safety state={state} busy={busy} act={act} />}
      {tab === "Care circle" && <Circle state={state} busy={busy} act={act} />}
    </>
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

function Today({ state, busy, withPin, setMsg }: { state: State; busy: boolean; withPin: (fn: (pin: string) => Promise<unknown>, ok?: string) => void; setMsg: (m: { text: string; ok?: boolean } | null) => void }) {
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
          {state.doseSlots.length === 0 && <Empty>No medicines yet. {role === "family" ? "Go to Medicines to suggest the first one." : "Family can suggest medicines; you accept them."}</Empty>}
          {state.doseSlots.map((slot) => (
            <article key={slot.id} className="rounded-xl border border-stone-200 bg-white p-4" style={{ borderLeftWidth: 8, borderLeftColor: slot.color_band }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold">{slot.medicine_name}</h3>
                  <p className="text-[var(--muted)]">{time12(slot.scheduled_at)} · {slot.instructions}</p>
                  <p className="mt-1">{STATUS_LABEL[slot.status] ?? slot.status}{slot.skip_reason ? ` — ${slot.skip_reason}` : ""}</p>
                </div>
                {role === "elder" && slot.status === "pending" && skipFor !== slot.id && (
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-primary" disabled={busy} onClick={() => withPin((pin) => api("/api/doses/confirm", { method: "POST", body: JSON.stringify({ doseSlotId: slot.id, pin }) }), "Saved: you took it.")}>Yes, I took it</button>
                    <button className="btn-ghost" disabled={busy} onClick={() => setSkipFor(slot.id)}>Not now</button>
                    <button className="btn-ghost" disabled={busy} onClick={() => setMsg({ text: "Okay. This dose stays open — you can answer later.", ok: true })}>Later</button>
                  </div>
                )}
                {role === "elder" && slot.status === "pending" && skipFor === slot.id && (
                  <div className="flex max-w-md flex-wrap gap-2">
                    <p className="w-full font-semibold">Why not now?</p>
                    {SKIP_REASONS.map((r) => (
                      <button key={r} className="btn-ghost" disabled={busy} onClick={() => { setSkipFor(null); withPin((pin) => api("/api/doses/skip", { method: "POST", body: JSON.stringify({ doseSlotId: slot.id, pin, reason: r }) }), "Saved. A skip is your decision — it is not counted as missed."); }}>{r}</button>
                    ))}
                    <button className="btn-ghost" onClick={() => setSkipFor(null)}>Back</button>
                  </div>
                )}
                {role === "caretaker" && (
                  <button className="btn-accent" disabled={busy} onClick={() => withPin((pin) => api("/api/doses/witness", { method: "POST", body: JSON.stringify({ doseSlotId: slot.id, pin }) }), "Saved as witnessed. Only the elder can mark it as taken.")}>I saw her take it</button>
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
          <div className="mt-3"><Stat label="Elder-confirmation rate" value={a.elderConfirmationRate == null ? "—" : `${a.elderConfirmationRate}%`} /></div>
          <p className="mt-2 text-sm text-[var(--muted)]">Rate = confirmed ÷ (confirmed + missed). Skips are her decision, not failures. A witness never counts as taken.</p>
        </section>
        {role === "elder" && (
          <section className="panel">
            <h2 className="text-xl font-semibold">I took it myself</h2>
            <p className="text-sm text-[var(--muted)]">Took something that is not on your list? Write it here so your family and doctor know.</p>
            <div className="mt-3 grid gap-2">
              <input className="input" placeholder="Medicine name (e.g. Brufen)" value={med} onChange={(e) => setMed(e.target.value)} aria-label="Medicine name" />
              <input className="input" placeholder="How much (e.g. 400 mg)" value={dose} onChange={(e) => setDose(e.target.value)} aria-label="How much" />
              <input className="input" placeholder="Why (e.g. knee pain)" value={why} onChange={(e) => setWhy(e.target.value)} aria-label="Why" />
              <button className="btn-primary" disabled={busy || !med} onClick={() => withPin((pin) => api("/api/doses/self-add", { method: "POST", body: JSON.stringify({ pin, medicineName: med, dose, reason: why, generateCard: true }) }), "Saved. A safety note was added under Safety.")}>Save and check safety</button>
            </div>
          </section>
        )}
        {state.appointments[0] && (
          <section className="panel">
            <h2 className="text-xl font-semibold">Next appointment</h2>
            <p className="mt-2 text-lg"><strong>{state.appointments[0].doctor}</strong> — {state.appointments[0].place}</p>
            <p className="text-[var(--muted)]">{dayLabel(state.appointments[0].scheduled_at)}, {time12(state.appointments[0].scheduled_at)} IST</p>
          </section>
        )}
      </div>
    </div>
  );
}

function describeProposal(p: State["proposals"][number], meds: State["medicines"]) {
  let pl: Record<string, string> = {};
  try { pl = JSON.parse(p.payload_json); } catch { /* ignore */ }
  const name = meds.find((m) => m.id === p.medicine_id)?.name ?? pl.name ?? "a medicine";
  if (p.kind === "add") return `Add ${name}${pl.dose ? ` (${pl.dose})` : ""} at ${pl.schedule_time}${pl.instructions ? ` — ${pl.instructions}` : ""}`;
  if (p.kind === "edit_schedule") return `Move ${name} to ${pl.schedule_time}`;
  if (p.kind === "stop") return `Stop ${name}${pl.reason ? ` — ${pl.reason}` : ""}`;
  return p.kind;
}

function Medicines({ state, busy, withPin }: { state: State; busy: boolean; withPin: (fn: (pin: string) => Promise<unknown>, ok?: string) => void }) {
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
            <div key={m.id} className="rounded-xl border bg-white p-3" style={{ borderLeftWidth: 8, borderLeftColor: m.color_band }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">{m.name} <span className="font-normal text-[var(--muted)]">{m.dose}</span></p>
                  <p className="text-[var(--muted)]">{m.schedule_time} · {m.instructions}</p>
                </div>
                {role === "family" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="time" className="input w-32" value={moveTime[m.id] ?? m.schedule_time} onChange={(e) => setMoveTime({ ...moveTime, [m.id]: e.target.value })} aria-label={`New time for ${m.name}`} />
                    <button className="btn-ghost" disabled={busy} onClick={() => withPin((pin) => api("/api/proposals", { method: "POST", body: JSON.stringify({ pin, kind: "edit_schedule", medicineId: m.id, payload: { schedule_time: moveTime[m.id] ?? m.schedule_time } }) }), "Suggestion sent. It changes only when the elder says yes.")}>Suggest time</button>
                    <button className="btn-ghost" disabled={busy} onClick={() => withPin((pin) => api("/api/proposals", { method: "POST", body: JSON.stringify({ pin, kind: "stop", medicineId: m.id, payload: { reason: "Discuss with the doctor" } }) }), "Suggestion sent.")}>Suggest stop</button>
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
                  <button className="btn-primary" disabled={busy} onClick={() => withPin((pin) => api("/api/proposals", { method: "PATCH", body: JSON.stringify({ pin, proposalId: p.id, decision: "accept" }) }), "Done. Your list is updated.")}>Yes, okay</button>
                  <button className="btn-ghost" disabled={busy} onClick={() => withPin((pin) => api("/api/proposals", { method: "PATCH", body: JSON.stringify({ pin, proposalId: p.id, decision: "reject" }) }), "Okay. Nothing was changed.")}>No</button>
                </div>
              </div>
            ))}
          </section>
        )}
        {role === "family" && (
          <section className="panel">
            <h2 className="text-2xl font-semibold">Suggest a new medicine</h2>
            <p className="text-sm text-[var(--muted)]">It is added only after the elder says yes. Thyronorm and Shelcal must be 4+ hours apart (fixed rule).</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <input className="input" placeholder="Name (e.g. Telma 40)" value={name} onChange={(e) => setName(e.target.value)} aria-label="Medicine name" />
              <input className="input" placeholder="Dose (e.g. 40 mg)" value={dose} onChange={(e) => setDose(e.target.value)} aria-label="Dose" />
              <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" />
              <input className="input" placeholder="Instructions (e.g. after breakfast)" value={instr} onChange={(e) => setInstr(e.target.value)} aria-label="Instructions" />
            </div>
            <button className="btn-primary mt-3" disabled={busy || !name} onClick={() => withPin((pin) => api("/api/proposals", { method: "POST", body: JSON.stringify({ pin, kind: "add", payload: { name, dose, schedule_time: time, instructions: instr } }) }), "Suggestion sent to the elder.")}>Send suggestion</button>
          </section>
        )}
        <section className="panel">
          <h2 className="text-xl font-semibold">All suggestions</h2>
          {state.proposals.length === 0 && <Empty>None yet.</Empty>}
          <ul className="mt-2 space-y-1">
            {state.proposals.map((p) => (
              <li key={p.id} className="flex justify-between gap-2 border-b py-1 text-sm">
                <span>{describeProposal(p, state.medicines)}</span>
                <span className="font-semibold">{p.status === "pending" ? "Waiting for elder" : p.status === "accepted" ? "Accepted" : "Declined"}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

type Weekly = { summary: { elder: string; caretaker: string; family: string }; source: string; disclaimer: string; stats: { rate: number | null; confirmed: number; missed: number; skipped: number; witnessed: number } };

function WeeklySummary({ state, busy, act }: { state: State; busy: boolean; act: ActFn }) {
  const [w, setW] = useState<Weekly | null>(null);
  const role = state.me.role;
  const text = w ? (role === "family" ? w.summary.family : role === "caretaker" ? w.summary.caretaker : w.summary.elder) : "";
  return (
    <section className="panel mb-6" aria-labelledby="weekly-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="weekly-h" className="text-2xl font-semibold">This week, in plain words</h2>
        <button className="btn-primary" disabled={busy} onClick={() => act(async () => setW((await api("/api/summary/weekly", { method: "POST" })) as Weekly))}>
          {w ? "Refresh weekly summary" : "Get weekly care summary (AI)"}
        </button>
      </div>
      <p className="text-sm text-[var(--muted)]">Numbers come from the log. Adaption only words them for {role === "elder" ? "you" : `the ${role}`}; it can never change a medicine.</p>
      {w && (
        <div className="mt-3">
          <p className="mb-2 text-sm"><span className="rounded-full bg-stone-100 px-2 py-0.5">source: {w.source === "adaption" ? "Adaption" : "template fallback"}</span>{" "}
            {w.stats.rate !== null && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-900">Elder-confirmation rate {w.stats.rate}%</span>}</p>
          <p className={`whitespace-pre-line ${role === "elder" ? "text-2xl leading-relaxed" : "text-lg"}`}>{text}</p>
          <p className="mt-3 text-xs text-[var(--muted)]">{w.disclaimer}</p>
        </div>
      )}
    </section>
  );
}

function History({ state }: { state: State }) {
  const byDay = new Map<string, Slot[]>();
  for (const s of state.history) {
    const d = s.scheduled_at.slice(0, 10);
    byDay.set(d, [...(byDay.get(d) ?? []), s]);
  }
  const badge: Record<string, string> = { elder_confirmed: "bg-emerald-100 text-emerald-900", skipped: "bg-amber-100 text-amber-900", missed: "bg-red-100 text-red-900", pending: "bg-stone-100 text-stone-700" };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="panel">
        <h2 className="text-2xl font-semibold">Last 7 days</h2>
        {byDay.size === 0 && <Empty>No doses recorded yet.</Empty>}
        {[...byDay.entries()].map(([day, slots]) => (
          <div key={day} className="mt-4">
            <h3 className="font-semibold">{dayLabel(day)}</h3>
            <ul className="mt-1 grid gap-1">
              {slots.sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at)).map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-lg border bg-white px-3 py-2">
                  <span>{time12(s.scheduled_at)} · {s.medicine_name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-sm ${badge[s.status] ?? ""}`}>{STATUS_LABEL[s.status]?.split(" —")[0] ?? s.status}{s.skip_reason ? ` (${s.skip_reason})` : ""}</span>
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
              <span className="text-sm text-[var(--muted)]">{dayLabel(e.created_at)} {time12(e.created_at)}</span><br />
              <strong>{e.actor_name}</strong> {EVENT_LABEL[e.type] ?? e.type}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Appointments({ state, busy, withPin }: { state: State; busy: boolean; withPin: (fn: (pin: string) => Promise<unknown>, ok?: string) => void }) {
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
              <div className="text-[var(--muted)]">{dayLabel(a.scheduled_at)}, {time12(a.scheduled_at)} IST</div>
              {a.notes && <div className="text-sm">{a.notes}</div>}
              {family && <button className="btn-ghost mt-2" onClick={() => { setEditId(a.id); setDoctor(a.doctor); setPlace(a.place); setWhen(a.scheduled_at.slice(0, 16)); }}>Edit</button>}
            </li>
          ))}
        </ul>
      </section>
      {family && (
        <section className="panel">
          <h2 className="text-2xl font-semibold">{editId ? "Edit appointment" : "Add appointment"}</h2>
          <div className="mt-3 grid gap-2">
            <input className="input" placeholder="Doctor" value={doctor} onChange={(e) => setDoctor(e.target.value)} aria-label="Doctor" />
            <input className="input" placeholder="Place" value={place} onChange={(e) => setPlace(e.target.value)} aria-label="Place" />
            <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Date and time (IST)" />
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn-primary" disabled={busy || !doctor || !place || !when} onClick={() => withPin((pin) => api("/api/appointments", { method: "POST", body: JSON.stringify({ pin, doctor, place, scheduled_at: when, ...(editId ? { id: editId } : {}) }) }).then(() => setEditId(null)), "Appointment saved.")}>{editId ? "Save changes" : "Add appointment"}</button>
            {editId && <button className="btn-ghost" onClick={() => setEditId(null)}>Cancel</button>}
          </div>
        </section>
      )}
    </div>
  );
}

function Safety({ state, busy, act }: { state: State; busy: boolean; act: ActFn }) {
  const role = state.me.role;
  const [brief, setBrief] = useState("");
  const [msgs, setMsgs] = useState<Record<string, { messages: { elder: string; caretaker: string; family: string }; source: string }>>({});
  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-semibold">Safety notes</h2>
          <button className="btn-ghost" disabled={busy} onClick={() => act(() => api("/api/cards/generate", { method: "POST", body: JSON.stringify({ context: "Weekly safety review of the current list" }) }), "New safety note added.")}>Check the list with Gemini</button>
        </div>
        <p className="text-sm text-[var(--muted)]">Gemini can only warn. Any answer that tries to change a dose is thrown away.</p>
        {state.cards.length === 0 && <Empty>No safety notes yet.</Empty>}
        <div className="mt-3 space-y-4">
          {state.cards.map((c) => (
            <article key={c.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <p className="text-sm uppercase tracking-wide text-amber-800">{c.severity === "review_required" ? "Needs a doctor's review" : c.severity === "urgent_review" ? "Talk to a doctor soon" : "For information"}</p>
              <h3 className="text-lg font-semibold">{c.title}</h3>
              <p className="mt-2 text-lg">{role === "family" ? c.family_line_en : role === "caretaker" ? c.caretaker_line_hi : c.elder_line_hi}</p>
              <p className="mt-2 text-sm"><strong>Tell the doctor:</strong> {c.tell_doctor}</p>
              <p className="mt-2 text-sm font-semibold text-[var(--danger)]">{c.emergency_line}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{c.disclaimer}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn-ghost" onClick={() => { const u = new SpeechSynthesisUtterance(role === "family" ? c.family_line_en : role === "caretaker" ? c.caretaker_line_hi : c.elder_line_hi); u.lang = "en-IN"; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); }}>Read aloud</button>
                <button className="btn-ghost" disabled={busy} onClick={() => act(async () => { const r = await api("/api/cards/messages", { method: "POST", body: JSON.stringify({ cardId: c.id }) }); setMsgs((m) => ({ ...m, [c.id]: r })); })}>Generate with Adaption</button>
              </div>
              {msgs[c.id] && (
                <div className="mt-3 rounded-xl border bg-white p-3">
                  <p className="font-semibold">Messages for the care circle (via Adaption) <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs">source: {msgs[c.id].source === "adaption" ? "Adaption" : "template fallback"}</span></p>
                  <p className="mt-2"><strong>For {state.household.elder_name.split(" ")[0]}:</strong> {msgs[c.id].messages.elder}</p>
                  <p className="mt-1"><strong>For the caretaker:</strong> {msgs[c.id].messages.caretaker}</p>
                  <pre className="mt-1 whitespace-pre-wrap font-sans"><strong>For family:</strong> {msgs[c.id].messages.family}</pre>
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
          <button className="btn-primary mt-3" disabled={busy} onClick={() => act(async () => setBrief((await api("/api/brief", { method: "POST" })).brief))}>Make doctor brief</button>
          {brief && <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-stone-100 p-3 text-sm">{brief}</pre>}
        </section>
        {role === "family" && (
          <section className="panel">
            <h2 className="text-xl font-semibold">Email reminders</h2>
            <p className="text-sm text-[var(--muted)]">Upcoming doses, missed doses (never skips) and appointments. Each email is sent once.</p>
            <button className="btn-ghost mt-3" disabled={busy} onClick={() => act(() => api("/api/reminders/run", { method: "POST" }), "Reminder check finished.")}>Run reminder check now</button>
            {state.outbox.length === 0 && <p className="mt-2 text-sm text-[var(--muted)]">No emails yet.</p>}
            <ul className="mt-2 space-y-1 text-sm">
              {state.outbox.map((o) => <li key={o.id} className="border-b py-1">{o.subject} → {o.to_email} <span className="text-[var(--muted)]">({o.status === "mock" ? "in-app only" : o.status})</span></li>)}
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
        <p className="text-[var(--muted)]">{state.household.elder_name}{state.household.elder_age ? `, ${state.household.elder_age}` : ""} · {state.household.city} · prefers {state.household.language}</p>
        <ul className="mt-3 space-y-2">
          {state.members.map((m) => <li key={m.id} className="rounded-xl border bg-white px-3 py-2"><strong>{m.name}</strong> — {ROLE_LABEL[m.role]}</li>)}
        </ul>
        {!hasElder && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">Next step: invite the elder so she can accept medicines and confirm doses.</p>}
      </section>
      {state.me.isOwner ? (
        <section className="panel">
          <h2 className="text-2xl font-semibold">Invite someone</h2>
          <p className="text-sm text-[var(--muted)]">Each code works once and expires in 48 hours. Share it privately.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["elder", "caretaker", "family"] as Role[]).map((r) => (
              <button key={r} className="btn-ghost" disabled={busy || (r === "elder" && hasElder)} onClick={() => act(async () => setLast(await api("/api/invites", { method: "POST", body: JSON.stringify({ role: r }) })))}>Invite {ROLE_LABEL[r].toLowerCase()}</button>
            ))}
          </div>
          {last && (
            <div className="mt-4 rounded-xl border-2 border-[var(--brand)] bg-white p-4">
              <p>Invite code for <strong>{ROLE_LABEL[last.role]}</strong> (shown only once):</p>
              <p className="my-2 font-mono text-3xl tracking-widest">{last.code}</p>
              <p className="break-all text-sm">Link: {last.link}</p>
            </div>
          )}
          <h3 className="mt-4 font-semibold">Recent invites</h3>
          {state.invites.length === 0 && <p className="text-sm text-[var(--muted)]">None yet.</p>}
          <ul className="text-sm">
            {state.invites.map((i) => <li key={i.id} className="border-b py-1">{ROLE_LABEL[i.role]} · {i.used_by ? "used" : Date.parse(i.expires_at) < Date.now() ? "expired" : "waiting"}</li>)}
          </ul>
        </section>
      ) : (
        <section className="panel"><Empty>Only the person who created this care circle can invite others.</Empty></section>
      )}
    </div>
  );
}
