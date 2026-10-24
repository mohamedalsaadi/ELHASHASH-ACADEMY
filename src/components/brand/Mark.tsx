// The brand: two open books laid face down are the double A of ALSAADI, tied by one gold ribbon. See DESIGN.md §0.
// Drawn on a 100-unit cap height with a 14-unit stroke. The viewBox ends at the baseline and the cap line, so it trims
// the leg ends square without a clip path. Ink is currentColor; the ribbon is --color-marker (gold).
const A1 = "M3.5 110 39 7 74.5 110";
const AA = "M260.5 110 296 7 331.5 110M332.5 110 368 7 403.5 110";
const RIBBON = "M271 66H393";

/** The AA monogram: favicons, small badges, seals. */
export function Mark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={(size * 100) / 160} viewBox="250 0 160 100" aria-hidden="true" className={`shrink-0 ${className}`} fill="none" strokeWidth="14">
      <path d={RIBBON} strokeWidth="12" className="stroke-marker" />
      <path d={AA} stroke="currentColor" strokeLinejoin="round" />
    </svg>
  );
}

/** The wordmark is Latin in both locales; "ACADEMY" sits under it, letter-spaced to the same width. */
export function Wordmark({ className = "" }: { locale?: string; className?: string }) {
  return (
    <span className={`inline-grid justify-items-center gap-[.28em] leading-none ${className}`}>
      <svg viewBox="-2 0 544 100" role="img" aria-label="Alsaadi Academy" className="h-[1em] w-auto" fill="none" strokeWidth="14">
        <path d={RIBBON} strokeWidth="12" className="stroke-marker" />
        <g stroke="currentColor">
          <path d="M15 66H63" strokeWidth="12" />
          <path d={A1 + AA} strokeLinejoin="round" />
          <path d="M102 -10V93H150M436 -10V110M436 7H453A43 43 0 0 1 453 93H436M532 -10V110" strokeLinejoin="miter" />
          <path d="M225 19C216 9 205 7 199 7 186 7 174 14 174 28 174 42 188 46 200 50 213 54 227 58 227 72 227 86 214 93 200 93 190 93 180 89 173 80" />
        </g>
      </svg>
      <span aria-hidden="true" className="font-body text-[.3em] font-normal tracking-[.72em] ps-[.72em] opacity-70">ACADEMY</span>
    </span>
  );
}

// Hand-drawn marking circle, kept for the "best value" and "your grade" highlights on catalog pages.
export const CIRCLE_PATH = "M24 4c11 0 20 8.5 20 19.5 0 11.5-9.5 20.5-21 20.5C12 44 4 35 4 24 4 13.5 12 5 22 4";

/** Empty state: the double A drawn dashed in pencil grey, a book not opened yet. */
export function EmptyMark({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 100) / 160} viewBox="250 0 160 100" aria-hidden="true" fill="none" strokeWidth="8" strokeDasharray="10 12" className="stroke-field">
      <path d={AA} strokeLinejoin="round" />
    </svg>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-lg border border-dashed border-hairline bg-surface p-8 text-center">
      <EmptyMark />
      {children}
    </div>
  );
}
