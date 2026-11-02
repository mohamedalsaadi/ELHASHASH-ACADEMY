// One landmark per country, drawn like the subject icons: 48 grid, ink strokes, one trail-green marking stroke, a ground line.
const LANDMARKS: Record<string, { ink: string; pen: string }> = {
  // The Giza pyramids under the sun.
  EG: { ink: "M4 40h40M7 40L20 19l13 21M27 30.5l6-8.5 11 18", pen: "M35 11a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0" },
  // Kingdom Centre, Riyadh, with its sky bridge.
  SA: { ink: "M4 40h40M16 40l2.5-28c1.5-4 3.5-6 5.5-6s4 2 5.5 6L32 40", pen: "M19.5 17c1.5 5 7.5 5 9 0" },
  // Burj Khalifa, Dubai.
  AE: { ink: "M4 40h40M17 40v-9h3v-9h2v-8h2M31 40v-9h-3v-9h-2v-8h-2", pen: "M24 14V3" },
  // Kuwait Towers.
  KW: {
    ink: "M4 40h40M20 40V28M20 16v-2M20 8V3M31 40v-8.5M31 22.5V14M38 40V20M14 22a6 6 0 1 0 12 0a6 6 0 1 0-12 0M17 11a3 3 0 1 0 6 0a3 3 0 1 0-6 0M26.5 27a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0",
    pen: "M14 22h12",
  },
  // Doha Tower.
  QA: { ink: "M4 40h40M17 40V18c0-7 3-11 7-12 4 1 7 5 7 12v22", pen: "M17 26l14-6M17 34l14-6" },
  // Bahrain World Trade Center: two sails joined by wind-turbine bridges.
  BH: { ink: "M4 40h40M9 40c2-12 6-23 13-32v32M39 40c-2-12-6-23-13-32v32", pen: "M22 17h4M22 24h4M22 31h4" },
  // A round fort tower, Nizwa.
  OM: { ink: "M4 40h40M12 40V20M36 40V20M12 20V15h4v3h4v-3h4v3h4v-3h4v3h4V15v5", pen: "M21 40v-7a3 3 0 0 1 6 0v7" },
};

export function Landmark({ code, size = 64 }: { code: string; size?: number }) {
  const art = LANDMARKS[code];
  if (!art) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <g fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d={art.ink} className="stroke-ink" />
        <path d={art.pen} className="stroke-pen" />
      </g>
    </svg>
  );
}
