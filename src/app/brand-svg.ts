// The Dhirwa mark, shared by Mark.tsx and the generated images (ImageResponse can't render React SVG components with classes).
// A 64 × 48 grid: three nested ridge lines closing in on one peak, and a gold point above them that is both the summit
// and the dot of ذ, the first letter of ذروة.
export const MARK_VIEWBOX = "0 0 64 48";
export const RIDGES = [
  "M4 43C16 39 24 17 32 15C40 17 48 39 60 43",
  "M14 43C22 39 27 25 32 23.5C37 25 42 39 50 43",
  "M24 43C28 40 30 32.5 32 31.5C34 32.5 36 40 40 43",
];
// Each ridge as its two halves, foot to peak: the intro draws them rising to meet.
export const RIDGE_HALVES: [string, string][] = [
  ["M4 43C16 39 24 17 32 15", "M60 43C48 39 40 17 32 15"],
  ["M14 43C22 39 27 25 32 23.5", "M50 43C42 39 37 25 32 23.5"],
  ["M24 43C28 40 30 32.5 32 31.5", "M40 43C36 40 34 32.5 32 31.5"],
];
export const SUMMIT = { cx: 32, cy: 6.5, r: 3.6 };
export const RIDGE_WIDTH = 3.2;

// Same values as tokens.css (ground, dark ground, ink, dark ink, summit).
export const PAPER = "#F5F5F7";
export const NIGHT = "#000000";
export const INK = "#1D1D1F";
export const SNOW = "#F5F5F7";
export const GOLD = "#E8B04B";

/** The mark as an SVG string: ink ridges on a light ground, or light ridges on black. */
export const markSvg = (ridge = INK) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}" fill="none"><g stroke="${ridge}" stroke-width="${RIDGE_WIDTH}" stroke-linecap="round">${RIDGES.map((d) => `<path d="${d}"/>`).join("")}</g><circle cx="${SUMMIT.cx}" cy="${SUMMIT.cy}" r="${SUMMIT.r}" fill="${GOLD}"/></svg>`;

export const svgUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
