// Static SVG strings of the logo for generated images (ImageResponse can't render React SVG components with classes).
// Geometry matches src/components/brand/Mark.tsx.
const AA = "M260.5 110 296 7 331.5 110M332.5 110 368 7 403.5 110";

export const monogramSvg = (ink: string, gold = "#F2B544") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="250 0 160 100" fill="none" stroke-width="14"><path d="M271 66H393" stroke="${gold}" stroke-width="12"/><path d="${AA}" stroke="${ink}" stroke-linejoin="round"/></svg>`;

export const wordmarkSvg = (ink: string, gold = "#F2B544") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 0 544 100" fill="none" stroke-width="14"><path d="M271 66H393" stroke="${gold}" stroke-width="12"/><g stroke="${ink}"><path d="M15 66H63" stroke-width="12"/><path d="M3.5 110 39 7 74.5 110${AA}" stroke-linejoin="round"/><path d="M102 -10V93H150M436 -10V110M436 7H453A43 43 0 0 1 453 93H436M532 -10V110" stroke-linejoin="miter"/><path d="M225 19C216 9 205 7 199 7 186 7 174 14 174 28 174 42 188 46 200 50 213 54 227 58 227 72 227 86 214 93 200 93 190 93 180 89 173 80"/></g></svg>`;

export const svgUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
