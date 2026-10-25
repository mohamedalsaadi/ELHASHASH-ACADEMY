// Static SVG strings of the logo for generated images (ImageResponse can't render React SVG components with classes).
// Geometry matches src/components/brand/Mark.tsx.
const AA = "M260.5 110 296 7 331.5 110M332.5 110 368 7 403.5 110";

export const monogramSvg = (ink: string, gold = "#F2B544") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="250 0 160 100" fill="none" stroke-width="14"><path d="M271 66H393" stroke="${gold}" stroke-width="12"/><path d="${AA}" stroke="${ink}" stroke-linejoin="round"/></svg>`;

export const svgUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
