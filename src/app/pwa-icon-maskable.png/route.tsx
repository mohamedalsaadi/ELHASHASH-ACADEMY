import { ImageResponse } from "next/og";
import { markSvg, svgUri } from "../brand-svg";

export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFFFF" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={svgUri(markSvg())} width={300} height={225} alt="" />
      </div>
    ),
    { width: 512, height: 512 },
  );
}
