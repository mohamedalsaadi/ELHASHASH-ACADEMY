import { ImageResponse } from "next/og";
import { monogramSvg, svgUri } from "../brand-svg";

export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#2430D8" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={svgUri(monogramSvg("#F6F7FB"))} width={150} height={94} alt="" />
      </div>
    ),
    { width: 192, height: 192 },
  );
}
