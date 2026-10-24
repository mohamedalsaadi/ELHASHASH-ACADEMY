import { ImageResponse } from "next/og";
import { monogramSvg, svgUri } from "./brand-svg";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#2430D8" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={svgUri(monogramSvg("#F6F7FB"))} width={128} height={80} alt="" />
      </div>
    ),
    size,
  );
}
