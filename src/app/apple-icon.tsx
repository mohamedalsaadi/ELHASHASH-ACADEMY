import { ImageResponse } from "next/og";
import { PAPER, markSvg, svgUri } from "./brand-svg";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: PAPER }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={svgUri(markSvg())} width={128} height={96} alt="" />
      </div>
    ),
    size,
  );
}
