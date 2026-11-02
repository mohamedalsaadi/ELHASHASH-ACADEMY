import { ImageResponse } from "next/og";
import { GOLD, NIGHT, SNOW, contourBandSvg, markSvg, svgUri } from "./brand-svg";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Dhirwa";

// The night map: the mark and the name in snow, the line underlined in summit gold, contour lines rising along the bottom.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: NIGHT, color: SNOW }}>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", gap: 36, padding: "0 96px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={svgUri(markSvg(SNOW))} width={176} height={132} alt="" />
            <div style={{ fontSize: 112, fontWeight: 700, letterSpacing: 4 }}>Dhirwa</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 40, opacity: 0.8 }}>Secondary school, step by step to the top.</div>
            <div style={{ display: "flex", width: 330, height: 7, borderRadius: 4, background: GOLD }} />
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={svgUri(contourBandSvg(1200, 150))} width={1200} height={150} alt="" />
      </div>
    ),
    size,
  );
}
