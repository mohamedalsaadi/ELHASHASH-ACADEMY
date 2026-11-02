// The Dhirwa mark, shared by Mark.tsx and the generated images (ImageResponse can't render React SVG components with classes).
// A 64 × 48 grid: three nested ridge lines, read as contour lines closing in on one peak, and a summit-gold point above
// them that is both the summit on the map and the dot of ذ, the first letter of ذروة.
export const MARK_VIEWBOX = "0 0 64 48";
export const RIDGES = [
  "M4 43C16 39 24 17 32 15C40 17 48 39 60 43",
  "M14 43C22 39 27 25 32 23.5C37 25 42 39 50 43",
  "M24 43C28 40 30 32.5 32 31.5C34 32.5 36 40 40 43",
];
export const SUMMIT = { cx: 32, cy: 6.5, r: 3.6 };
export const RIDGE_WIDTH = 3.2;

// Same values as tokens.css (ground, night, ink, contour-6, summit).
export const PAPER = "#F6F3EC";
export const NIGHT = "#0F1B2D";
export const INK = "#13202F";
export const SNOW = "#EEF0EA";
export const GOLD = "#E8B04B";

/** The mark as an SVG string: ink ridges on paper, or snow ridges on the night map. */
export const markSvg = (ridge = INK) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}" fill="none"><g stroke="${ridge}" stroke-width="${RIDGE_WIDTH}" stroke-linecap="round">${RIDGES.map((d) => `<path d="${d}"/>`).join("")}</g><circle cx="${SUMMIT.cx}" cy="${SUMMIT.cy}" r="${SUMMIT.r}" fill="${GOLD}"/></svg>`;

export const svgUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

// The elevation ramp, in tokens.css order (contour-1..6).
export const CONTOURS = ["#3E5C7A", "#5D7FA0", "#8FB0C9", "#C3D3DE", "#2F8F6B", "#EEF0EA"];

/** A band of contour lines rising to one gold point, for the bottom of the share images (Satori can't use CSS backgrounds). */
export const contourBandSvg = (w: number, h: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" fill="none"><g stroke-width="3" stroke-linecap="round">${CONTOURS.slice(0, 4)
    .map((c, i) => {
      const y = h - 8 - i * (h / 6), peak = y - h * 0.32;
      return `<path d="M0 ${y}C${w * 0.2} ${y} ${w * 0.38} ${peak} ${w * 0.62} ${peak}S${w * 0.85} ${y} ${w} ${y}" stroke="${c}"/>`;
    })
    .join("")}</g><circle cx="${w * 0.62}" cy="${h - 8 - 3 * (h / 6) - h * 0.32 - 14}" r="8" fill="${GOLD}"/></svg>`;
