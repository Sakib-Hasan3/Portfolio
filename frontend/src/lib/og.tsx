import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

/** Branded 1200x630 share card (dark, matches the site). Used for each project, paper and note. */
export function ogCard({ eyebrow, title, subtitle, chips = [], footer }: { eyebrow: string; title: string; subtitle?: string; chips?: string[]; footer?: string }) {
  const size = title.length > 90 ? 52 : title.length > 55 ? 62 : 74;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "linear-gradient(135deg,#121419 0%,#1a1f2e 60%,#232a44 100%)", color: "#e6e8ee", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 14, height: 14, borderRadius: 999, background: "#8ea2ff" }} />
          <div style={{ fontSize: 26, letterSpacing: 4, textTransform: "uppercase", color: "#8ea2ff" }}>{eyebrow}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: size, fontWeight: 700, letterSpacing: -2, lineHeight: 1.06 }}>{title.slice(0, 140)}</div>
          {subtitle ? <div style={{ fontSize: 30, marginTop: 24, color: "#9aa2b6", lineHeight: 1.35 }}>{subtitle.slice(0, 170)}</div> : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 10 }}>
            {chips.slice(0, 4).map((c) => (
              <div key={c} style={{ border: "1px solid #363b48", borderRadius: 999, padding: "6px 16px", fontSize: 22, color: "#9aa2b6" }}>{c}</div>
            ))}
          </div>
          <div style={{ fontSize: 26, color: "#e6e8ee" }}>{footer}</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
