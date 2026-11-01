import { ImageResponse } from "next/og";
import { LINES, markSvg, svgUri } from "./brand-svg";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A+ Academy";


// White enamel ground, the heavy ink rule of the site header, the mark and name, and the network lines as a band.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#FFFFFF", color: "#111418" }}>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", gap: 32, padding: "0 96px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={svgUri(markSvg())} width={176} height={132} alt="" />
            <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -2 }}>A+ Academy</div>
          </div>
          <div style={{ fontSize: 36, color: "#4D535C" }}>Every station of the school year, before you sign up.</div>
        </div>
        <div style={{ display: "flex", height: 14, background: "#111418" }} />
        <div style={{ display: "flex", height: 34 }}>
          {LINES.map((c) => <div key={c} style={{ flex: 1, background: c }} />)}
        </div>
      </div>
    ),
    size,
  );
}
