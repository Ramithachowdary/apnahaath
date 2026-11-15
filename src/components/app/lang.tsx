"use client";

/** Client-side UI language: remembered in localStorage and a cookie, mirrored to <html lang>. */
import { useSyncExternalStore } from "react";
import { Languages } from "lucide-react";
import { dayPartKey } from "./format";
import { LANGS, LANG_STORAGE_KEY, normalizeLang, t, type Lang, type MsgKey } from "@/lib/i18n";

let current: Lang | null = null;
const listeners = new Set<() => void>();

function read(): Lang {
  if (current) return current;
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  } catch {
    /* storage blocked */
  }
  if (!stored) stored = /(?:^|;\s*)ah_lang=([a-z]{2})/.exec(document.cookie)?.[1] ?? null;
  current = normalizeLang(stored);
  document.documentElement.lang = current;
  return current;
}

export function setLang(lang: Lang) {
  current = lang;
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* storage blocked */
  }
  document.cookie = `${LANG_STORAGE_KEY}=${lang}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Current language plus a bound translate function. English on the server and until a choice is made. */
export function useT() {
  const lang = useSyncExternalStore(subscribe, read, () => "en" as Lang);
  const tr = (key: MsgKey, vars?: Record<string, string | number>) => t(lang, key, vars);
  /** Translated part of the day for a time value, e.g. "Morning". */
  const dayPart = (value: string) => {
    const k = dayPartKey(value);
    return k ? tr(k) : "";
  };
  return { lang, tr, dayPart };
}

export function LanguageSelect({ className = "" }: { className?: string }) {
  const { lang, tr } = useT();
  return (
    <label className={`flex items-center gap-1.5 text-sm font-semibold ${className}`}>
      <Languages size={18} aria-hidden="true" />
      <span className="sr-only">{tr("app.language")}</span>
      <select
        className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm"
        value={lang}
        onChange={(e) => setLang(normalizeLang(e.target.value))}
        aria-label="Language / भाषा"
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
