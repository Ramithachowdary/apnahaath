import { ImageResponse } from "next/og";

export const alt = "ApnaHaath — Medicine from her hand. The log in her name.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: 72, background: "linear-gradient(135deg, #f3efe6 0%, #fffdf8 60%, #f1e2d6 100%)", color: "#1c1917",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, letterSpacing: 8, color: "#0f5c4c", fontWeight: 700 }}>APNAHAATH</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 82, fontWeight: 700, lineHeight: 1.05 }}>Dawai unke haath se.</div>
          <div style={{ fontSize: 82, fontWeight: 700, lineHeight: 1.05, color: "#a84a1c" }}>Log unke naam se.</div>
          <div style={{ fontSize: 36, marginTop: 24, color: "#57534e" }}>Medicine from her hand. The log in her name.</div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 24, flexWrap: "wrap" }}>
          {["Elder confirms", "Caretaker witnesses", "Family proposes", "AI warns, never prescribes"].map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "center", padding: "12px 26px", borderRadius: 999, background: "#0f5c4c", color: "#fff", whiteSpace: "nowrap" }}>{t}</div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
