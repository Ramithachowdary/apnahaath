import { NextResponse } from "next/server";
import { redeemDoseToken, verifyDoseToken } from "@/lib/doselink";
import { EMERGENCY_LINE } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function page(title: string, body: string, status = 200) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} · ApnaHaath</title>
<style>body{font-family:system-ui,sans-serif;background:#f6f1e7;color:#1c1917;margin:0;padding:24px;font-size:20px;line-height:1.5}main{max-width:480px;margin:10vh auto;background:#fffdf7;border:1px solid #e7e0d2;border-radius:16px;padding:28px}h1{font-size:28px;margin:0 0 12px}button,a.btn{display:inline-block;min-height:56px;min-width:200px;font-size:22px;font-weight:700;border-radius:14px;border:0;background:#0f5c4c;color:#fff;padding:12px 24px;cursor:pointer;text-decoration:none;text-align:center}button:focus-visible,a:focus-visible{outline:3px solid #a84a1c;outline-offset:3px}.em{color:#9f1d1d;font-size:16px;margin-top:20px}</style></head>
<body><main><p>ApnaHaath</p><h1>${esc(title)}</h1>${body}<p class="em">${esc(EMERGENCY_LINE)}</p></main></body></html>`;
  return new NextResponse(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

/** GET never changes anything (mail scanners prefetch links); it shows a one-tap button that POSTs. */
export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  const v = verifyDoseToken(t);
  if (!v.ok) return page("Link not valid", `<p>${esc(v.reason)}</p><a class="btn" href="/">Open ApnaHaath</a>`, 400);
  const elder = v.payload.role === "elder";
  return page(
    elder ? "Did you take your medicine?" : "Record that you saw the dose",
    `<p>${elder ? "Tap once to record it in your own name." : "This records you as a witness. Only the elder can mark a dose as taken."}</p>
<form method="post" action="/api/doses/link"><input type="hidden" name="t" value="${esc(t)}"><button type="submit">${elder ? "Yes, I took it" : "I saw it taken"}</button></form>`,
  );
}

export async function POST(req: Request) {
  let t = "";
  try {
    const form = await req.formData();
    t = String(form.get("t") ?? "");
  } catch {
    return page("Link not valid", "<p>This link is not valid.</p>", 400);
  }
  const r = await redeemDoseToken(t);
  if (!r.ok) return page("Not recorded", `<p>${esc(r.reason)}</p><a class="btn" href="/">Open ApnaHaath</a>`, r.status);
  return page(
    r.outcome === "elder_confirmed" ? "Thank you — saved" : "Witness recorded",
    r.outcome === "elder_confirmed"
      ? `<p>${esc(r.medicine)} is marked as taken, in your name.</p>`
      : `<p>You are recorded as a witness for ${esc(r.medicine)}. The dose is not marked as taken — only the elder can do that.</p>`,
  );
}
