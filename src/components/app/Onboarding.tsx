"use client";

/** First run: create a care circle or join one with an invite code. */
import { useState } from "react";
import type { Role, Me, ActFn } from "./types";
import { ROLE_LABEL } from "./constants";
import { api } from "./helpers";

export function Onboarding({ me, busy, act, invite }: { me: Me; busy: boolean; act: ActFn; invite: string }) {
  const [elder, setElder] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [language, setLanguage] = useState("English");
  const [role, setRole] = useState<Role>("family");
  const [code, setCode] = useState(invite);
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
                () => api("/api/invites/join", { method: "POST", body: JSON.stringify({ code }) }),
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
            <button className="btn-primary" disabled={busy} type="submit">
              Join care circle
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
