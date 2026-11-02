import { ImageResponse } from "next/og";
import { CHALKS, CHALK_WHITE, PAPER, SLATE, WOOD, markSvg, svgUri } from "./brand-svg";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Sabboura";

// The board: slate, the mark and the name in chalk white, the line underlined in yellow chalk, the wooden tray with its
// coloured chalk along the bottom.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: SLATE, color: CHALK_WHITE }}>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", gap: 36, padding: "0 96px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            {/* The board sits on a paper tile, as on the app icon, so it reads on the slate. */}
            <div style={{ display: "flex", padding: 20, borderRadius: 32, background: PAPER }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={svgUri(markSvg())} width={176} height={132} alt="" />
            </div>
            <div style={{ fontSize: 104, fontWeight: 700, letterSpacing: -2 }}>Sabboura</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 40, opacity: 0.8 }}>Your teacher at the board, wherever you are.</div>
            <div style={{ display: "flex", width: 330, height: 7, borderRadius: 4, background: CHALKS[0] }} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 18, height: 52, padding: "0 96px", background: WOOD }}>
          {CHALKS.slice(0, 5).map((c) => (
            <div key={c} style={{ display: "flex", width: 74, height: 16, marginBottom: 36, borderRadius: 6, background: c }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
