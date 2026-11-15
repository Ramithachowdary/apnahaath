/**
 * Accessibility checks (WCAG 2.2 AA oriented). These are automated structural checks on the
 * server-rendered landing page, the one-tap dose page and the CSS — not a full manual audit.
 */
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CareApp from "../src/components/CareApp";

const root = path.resolve(__dirname, "..");
/** The care app UI is split across CareApp.tsx and src/components/app/*; check them together. */
const appSource = () =>
  [
    "src/components/CareApp.tsx",
    ...readdirSync(path.join(root, "src/components/app")).map((f) => `src/components/app/${f}`),
  ]
    .map((f) => readFileSync(path.join(root, f), "utf8"))
    .join("\n");
const css = readFileSync(path.join(root, "src/app/globals.css"), "utf8");
const landing = renderToStaticMarkup(<CareApp hasSession={false} />);

function hexToLum(hex: string) {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [hexToLum(a), hexToLum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const cssVar = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)![1];

describe("accessibility", () => {
  it("the document declares its language (WCAG 3.1.1)", () => {
    expect(readFileSync(path.join(root, "src/app/layout.tsx"), "utf8")).toMatch(/<html lang="en">/);
  });

  it("every form field on the landing page has a label (WCAG 1.3.1 / 4.1.2)", () => {
    const inputs = [...landing.matchAll(/<(input|select|textarea)\b([^>]*)>/g)].filter(
      (m) => !/type="hidden"/.test(m[2]),
    );
    expect(inputs.length).toBeGreaterThan(0);
    for (const [, , attrs] of inputs) {
      const id = /\bid="([^"]+)"/.exec(attrs)?.[1];
      const labelled = /aria-label(ledby)?="/.test(attrs) || (id && landing.includes(`for="${id}"`));
      expect(labelled, `unlabelled field: ${attrs}`).toBeTruthy();
    }
  });

  it("every button has an accessible name (WCAG 4.1.2)", () => {
    const buttons = [...landing.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
    expect(buttons.length).toBeGreaterThan(0);
    for (const [, attrs, inner] of buttons) {
      const text = inner.replace(/<[^>]+>/g, "").trim();
      expect(text.length > 0 || /aria-label="[^"]+"/.test(attrs)).toBe(true);
    }
  });

  it("buttons and inputs are at least 44px tall (WCAG 2.5.8, enhanced 2.5.5 size)", () => {
    for (const cls of ["btn", "input"]) {
      const block = new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";
      const rem = /min-height:\s*([\d.]+)rem/.exec(block);
      expect(rem, `.${cls} needs a min-height`).toBeTruthy();
      expect(parseFloat(rem![1]) * 16).toBeGreaterThanOrEqual(44);
    }
  });

  it("text colours meet 4.5:1 contrast on the page and card backgrounds (WCAG 1.4.3)", () => {
    for (const fg of ["ink", "muted", "brand", "brand-2", "danger"]) {
      for (const bg of ["bg", "card"]) {
        expect(contrast(cssVar(fg), cssVar(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("dose status is always written in words, not colour alone (WCAG 1.4.1)", () => {
    const src = appSource();
    for (const status of ["pending", "elder_confirmed", "skipped", "missed"]) {
      expect(src).toMatch(new RegExp(`${status}: "[A-Z][^"]+"`));
    }
  });

  it("display toggles switch their label and aria-pressed (Large/Small, High/Normal contrast)", () => {
    const src = appSource();
    expect(src).toContain("aria-pressed={large}");
    expect(src).toContain('{large ? "Small" : "Large"}');
    expect(src).toContain("aria-pressed={contrast}");
    expect(src).toContain('{contrast ? "Normal contrast" : "High contrast"}');
  });

  it("messages use a live status region", () => {
    const src = appSource();
    expect(src).toMatch(/role="status"/);
  });

  it("the one-tap email page is usable: lang, large 56px button, visible focus", async () => {
    const { GET } = await import("../src/app/api/doses/link/route");
    const html = await (await GET(new Request("http://localhost/api/doses/link?t=bad"))).text();
    expect(html).toMatch(/<html lang="en">/);
    expect(html).toMatch(/min-height:56px/);
    expect(html).toMatch(/focus-visible\{outline:3px/);
  });
});
