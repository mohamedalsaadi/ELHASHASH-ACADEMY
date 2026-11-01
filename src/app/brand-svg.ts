// The A+ mark, shared by Mark.tsx and the generated images (ImageResponse can't render React SVG components with classes).
// A 64 × 48 grid, one 6-unit line weight. The A is routed like a metro line: stems at 90°, shoulders at 45°, a crossbar.
// The + is the interchange: the Egypt line and the UAE line, the two in service, crossing at a white roundel.
export const MARK_VIEWBOX = "0 0 64 48";
export const A_PATH = "M6 45V25L24 7L42 25V45M6 31H42";
export const PLUS_H = "M45 17H63";
export const PLUS_V = "M54 8V26";
export const ROUNDEL = { cx: 54, cy: 17, r: 4.5 };
export const LINE_EG = "#D7262E";
export const LINE_AE = "#1F6FD1";

export const markSvg = (ink = "#111418", ring = ink) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}" fill="none" stroke-width="6"><path d="${A_PATH}" stroke="${ink}" stroke-linejoin="miter"/><path d="${PLUS_H}" stroke="${LINE_EG}"/><path d="${PLUS_V}" stroke="${LINE_AE}"/><circle cx="${ROUNDEL.cx}" cy="${ROUNDEL.cy}" r="${ROUNDEL.r}" fill="#FFFFFF" stroke="${ring}" stroke-width="3"/></svg>`;

export const svgUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

// The seven country lines in catalogue order, Egypt first; same values as --color-line-* in tokens.css.
export const LINES = ["#D7262E", "#1A7F3C", "#1F6FD1", "#00807E", "#8A1538", "#E8761C", "#7A3E9D"];
