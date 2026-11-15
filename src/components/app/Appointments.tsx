"use client";

/** Appointments tab: doctor visits with email reminders and Google Calendar links. */
import { useState } from "react";
import type { State } from "./types";
import { api, time12, dayLabel } from "./helpers";
import { TimeField, AddToGoogleCalendar } from "./ui";

export function Appointments({
  state,
  busy,
  doAction,
}: {
  state: State;
  busy: boolean;
  doAction: (fn: () => Promise<unknown>, ok?: string) => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [doctor, setDoctor] = useState("");
  const [place, setPlace] = useState("");
  const [when, setWhen] = useState("");
  const family = state.me.role === "family";
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="panel">
        <h2 className="text-2xl font-semibold">Upcoming visits</h2>
        {state.appointments.length === 0 && (
          <div className="mt-3 rounded-xl border border-dashed p-6 text-center">
            <p className="text-lg font-semibold">No appointments scheduled.</p>
            <p className="mt-1 text-[var(--muted)]">
              {family
                ? "Add a doctor visit to keep your family informed."
                : "A family member can add doctor visits. They will show here."}
            </p>
            {family && (
              <button
                type="button"
                className="btn-primary mt-3"
                onClick={() => document.getElementById("appt-doctor")?.focus()}
              >
                Add appointment
              </button>
            )}
          </div>
        )}
        <ul className="mt-3 space-y-2">
          {state.appointments.map((a) => (
            <li key={a.id} className="rounded-xl border bg-white p-3">
              <strong>{a.doctor}</strong>, {a.place}
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
              id="appt-doctor"
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
                doAction(
                  () =>
                    api("/api/appointments", {
                      method: "POST",
                      body: JSON.stringify({
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
