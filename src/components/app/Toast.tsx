"use client";

/** Toast messages: one at a time, announced through a live status region, dismissed automatically. */
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

/** How long a success message stays on screen. */
const TOAST_OK_MS = 4000;
/** Errors stay longer so they can be read. */
const TOAST_ERROR_MS = 8000;

/** A message to show, or null for none. */
export type Flash = { text: string; ok?: boolean } | null;

/** Toast state that clears itself after a few seconds. */
export function useFlash() {
  const [msg, setMsg] = useState<Flash>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), msg.ok ? TOAST_OK_MS : TOAST_ERROR_MS);
    return () => clearTimeout(t);
  }, [msg]);
  return [msg, setMsg] as const;
}

export function Toast({ msg, onDismiss }: { msg: Flash; onDismiss: () => void }) {
  if (!msg) return null;
  return (
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
        <button type="button" className="ml-2 font-semibold underline" onClick={onDismiss} aria-label="Dismiss message">
          ×
        </button>
      </p>
    </div>
  );
}

/** Placeholder while the session is checked or the browser is being redirected. */
export function OpeningScreen() {
  return (
    <main className="mx-auto min-h-[60vh] max-w-6xl px-5 py-16" aria-busy="true">
      <p className="text-lg text-[var(--muted)]">Opening your care circle…</p>
    </main>
  );
}
