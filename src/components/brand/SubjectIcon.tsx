// Subject line icons on the brand's 48 grid: ink strokes plus one pen-red marking stroke (see Mark.tsx).
// Keys match Subject.icon; anything unknown falls back to "book".
const BUBBLE = "M12 10h24a5 5 0 0 1 5 5v13a5 5 0 0 1-5 5H22l-8 6v-6h-2a5 5 0 0 1-5-5V15a5 5 0 0 1 5-5z";
const CIRCLE = "M8 24a16 16 0 1 0 32 0a16 16 0 1 0-32 0";

const ICONS: Record<string, { ink: string; pen: string }> = {
  arabic: { ink: BUBBLE, pen: "M26 21c2-4 10-5 10-1s-6 3-10 1c0 6-4 8-8 8s-7-2-7-6M30.4 13.5a.6.6 0 1 0 1.2 0a.6.6 0 1 0-1.2 0" },
  english: { ink: BUBBLE, pen: "M11 30l5-14 5 14M13 25.5h6M32 22.5v7.5M32 26a3.5 3.5 0 1 0-7 0a3.5 3.5 0 1 0 7 0" },
  french: { ink: BUBBLE, pen: "M14 30V16h8M14 23h6M27 30v-8M27 25c1-2.5 3-3.5 6-3" },
  math: { ink: "M10 15h12M16 9v12M27 15h12M11 28l9 9M20 28l-9 9", pen: "M27 30h12M27 36h12" },
  science: { ink: "M19 7h10M21 7v13L10.5 38.2A2.5 2.5 0 0 0 12.7 42h22.6a2.5 2.5 0 0 0 2.2-3.8L27 20V7", pen: "M15 31h18" },
  physics: {
    ink: "M8 24a16 6 0 1 0 32 0a16 6 0 1 0-32 0M16 10.14a16 6 60 1 0 16 27.72a16 6 60 1 0-16-27.72M16 37.86a16 6 -60 1 0 16-27.72a16 6 -60 1 0-16 27.72",
    pen: "M21.5 24a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0",
  },
  chemistry: { ink: "M24 8l14 8v16l-14 8l-14-8V16z", pen: "M18 24a6 6 0 1 0 12 0a6 6 0 1 0-12 0" },
  biology: { ink: "M15 6c0 9 18 9 18 18s-18 9-18 18M33 6c0 9-18 9-18 18s18 9 18 18", pen: "M19 10.5h10M17 21h14M17 27h14M19 37.5h10" },
  islamic: {
    ink: "M8 17c5-2 11-2 16 2c5-4 11-4 16-2v12c-5-2-11-2-16 2c-5-4-11-4-16-2zM24 19v12M15 42l18-11M33 42L15 31",
    pen: "M28 3a5 5 0 1 0 0 9a4.5 4.5 0 0 1 0-9z",
  },
  social: { ink: "M12 22v12M20 22v12M28 22v12M36 22v12M8 38h32", pen: "M8 18L24 9l16 9z" },
  history: { ink: "M13 7h22M13 41h22M16 7c0 10 16 10 16 17s-16 7-16 17M32 7c0 10-16 10-16 17s16 7 16 17", pen: "M19 37c2-3 8-3 10 0" },
  geography: { ink: CIRCLE + "M24 8c-7 5-7 27 0 32M24 8c7 5 7 27 0 32", pen: "M8 24h32" },
  philosophy: {
    ink: "M9 14h30M34 9l5 5-5 5",
    pen: "M22 27a2 2 0 1 0 4 0a2 2 0 1 0-4 0M16 37a2 2 0 1 0 4 0a2 2 0 1 0-4 0M28 37a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
  },
  psychology: { ink: CIRCLE, pen: "M24 14v21M17 16c0 9 2 11 7 11s7-2 7-11" },
  economics: { ink: "M8 8v32h32M15 34v-6M22 34v-10M29 34v-14", pen: "M14 22l8-7 5 4 10-10M31 9h6v6" },
  ict: { ink: "M8 9h32v23H8zM18 40h12M24 32v8", pen: "M20 16l-4 4.5 4 4.5M28 16l4 4.5-4 4.5" },
  statistics: { ink: "M6 39h36M8 38c6 0 9-24 16-24s10 24 16 24", pen: "M24 14v25" },
  art: { ink: "M39 8L24 23M21 20l7 7", pen: "M22 26c-3-1-6 0-7.5 3s-1.5 7-6.5 9c5 1.5 11 0 13.5-3.5s2-6 .5-8.5" },
  pe: { ink: "M10 17v14M16 13v22M32 13v22M38 17v14", pen: "M16 24h16" },
  book: { ink: "M12 8h22a2 2 0 0 1 2 2v30H14a2 2 0 0 1-2-2zM12 36a2 2 0 0 1 2-2h22", pen: "M28 8v12l-3-2.5-3 2.5V8" },
};

/** Keys accepted by `Subject.icon`; the admin catalog offers these. */
export const SUBJECT_ICONS = Object.keys(ICONS);

/** `muted` draws the whole icon in pencil grey: the "coming soon" state. */
export function SubjectIcon({ icon, size = 48, muted = false }: { icon: string; size?: number; muted?: boolean }) {
  const { ink, pen } = ICONS[icon] ?? ICONS.book;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="shrink-0 overflow-visible">
      <g fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d={ink} className={muted ? "stroke-field" : "stroke-ink"} />
        <path d={pen} className={muted ? "stroke-field" : "stroke-pen"} />
      </g>
    </svg>
  );
}
