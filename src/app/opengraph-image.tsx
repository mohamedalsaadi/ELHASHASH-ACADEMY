import { ImageResponse } from "next/og";
import { NIGHT, SNOW, markSvg, svgUri } from "./brand-svg";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Dhirwa";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 28, background: NIGHT, color: SNOW }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={svgUri(markSvg(SNOW))} width={208} height={156} alt="" />
        <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: 2 }}>Dhirwa</div>
        <div style={{ fontSize: 38, opacity: 0.7 }}>Secondary school, step by step to the top.</div>
      </div>
    ),
    size,
  );
}
