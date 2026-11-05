import { ImageResponse } from "next/og";
import { getPortfolioSafe } from "@/lib/api/server";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Portfolio preview";
export const dynamic = "force-dynamic";

/** Generated Open Graph card, used unless an OG image is set in Website settings. */
export default async function OgImage() {
  const data = await getPortfolioSafe();
  const p = data?.profile;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#121419", color: "#e6e8ee", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", gap: 12 }}>
          {(p?.specialties ?? []).slice(0, 4).map((s) => (
            <div key={s} style={{ border: "1px solid #363b48", borderRadius: 999, padding: "8px 18px", fontSize: 24, color: "#8b92a3" }}>{s}</div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>{p?.full_name ?? "Portfolio"}</div>
          <div style={{ fontSize: 40, marginTop: 20, color: "#8ea2ff" }}>{p?.title ?? ""}</div>
        </div>
        <div style={{ fontSize: 26, color: "#8b92a3", maxWidth: 900 }}>{p?.hero_headline ?? ""}</div>
      </div>
    ),
    size,
  );
}
