import { ImageResponse } from "next/og";
import { monogramSvg, svgUri } from "./brand-svg";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A+ Academy";

// Night ground with the lapis fold slash, the wordmark and the tagline in both languages.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#0B0F4A", color: "#F6F7FB" }}>
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 520, background: "#2430D8", clipPath: "polygon(217px 0, 100% 0, 100% 100%, 0 100%)" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 36, padding: "0 96px", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={svgUri(monogramSvg("#F6F7FB"))} width={150} height={94} alt="" />
            <div style={{ fontSize: 86, fontWeight: 700, letterSpacing: -2 }}>A+ Academy</div>
          </div>
          <div style={{ fontSize: 34, color: "#F2B544" }}>Every page counts.</div>
        </div>
      </div>
    ),
    size,
  );
}
