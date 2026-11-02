// The Sabboura mark, shared by Mark.tsx and the generated images (ImageResponse can't render React SVG components with classes).
// A 64 × 48 grid: a slate board on its wooden ledge, a stick of yellow chalk on the ledge, and on the board one chalk
// stroke that writes the letter س (seen), the first letter of سبّورة. Its three teeth also read as a handwriting squiggle.
export const MARK_VIEWBOX = "0 0 64 48";
export const BOARD = { x: 3, y: 3, width: 58, height: 34, rx: 5 };
export const SEEN = "M50 11V19Q50 23 46 23Q42 23 42 19V14V19Q42 23 38 23Q34 23 34 19V14V21Q34 31 24 31Q14 31 14 22";
export const LEDGE = "M9 43H55";
export const CHALK = { x: 39, y: 37.2, width: 13, height: 4, rx: 1.6 };

// Same values as tokens.css (ground, night, chalk-6, chalk-1, wood).
export const PAPER = "#F5F2EA";
export const SLATE = "#15251F";
export const CHALK_WHITE = "#EEF1EA";
export const CHALK_YELLOW = "#F2D06B";
export const WOOD = "#8A5A36";

export const markSvg = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}" fill="none"><rect x="${BOARD.x}" y="${BOARD.y}" width="${BOARD.width}" height="${BOARD.height}" rx="${BOARD.rx}" fill="${SLATE}"/><path d="${SEEN}" stroke="${CHALK_WHITE}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><path d="${LEDGE}" stroke="${WOOD}" stroke-width="4" stroke-linecap="round"/><rect x="${CHALK.x}" y="${CHALK.y}" width="${CHALK.width}" height="${CHALK.height}" rx="${CHALK.rx}" fill="${CHALK_YELLOW}"/></svg>`;

export const svgUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

// The coloured chalk, in tokens.css order (chalk-1..6).
export const CHALKS = ["#F2D06B", "#F4A261", "#F2A6B8", "#8CC4E8", "#A9DDB3", "#EEF1EA"];
