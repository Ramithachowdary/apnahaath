"use client";

/**
 * Light / Dark theme toggle.
 * - Reads and writes `data-theme` on <html>.
 * - Persists choice in localStorage ("ah-theme").
 * - Initial value is applied by an inline script in layout.tsx to prevent flash.
 */
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read the theme already applied by the anti-flash script
    const current = document.documentElement.getAttribute("data-theme");
    setDark(current === "dark");
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const theme = dark ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("ah-theme", theme);
    } catch {
      /* storage blocked */
    }
  }, [dark, mounted]);

  if (!mounted) {
    // Render a stable placeholder to avoid hydration mismatch
    return (
      <button
        type="button"
        className="theme-toggle"
        aria-label="Toggle theme"
        style={{ opacity: 0, pointerEvents: "none" }}
      >
        <Sun size={18} aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setDark((d) => !d)}
      title={dark ? "Light mode" : "Dark mode"}
    >
      {dark ? (
        <Sun size={18} aria-hidden="true" />
      ) : (
        <Moon size={18} aria-hidden="true" />
      )}
    </button>
  );
}

