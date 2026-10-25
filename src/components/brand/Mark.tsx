// The brand: two open books laid face down are the double A, tied by one gold ribbon. See DESIGN.md §0.
// Drawn on a 100-unit cap height with a 14-unit stroke. The viewBox ends at the baseline and the cap line, so it trims
// the leg ends square without a clip path. Ink is currentColor; the ribbon is --color-marker (gold).
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

/** The wordmark: the monogram plus "AAcademy" in Readex; Latin in both locales. */
export function Wordmark({ className = "" }: { locale?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[.32em] leading-none ${className}`} dir="ltr">
      <svg viewBox="250 0 160 100" aria-hidden="true" className="h-[1.05em] w-auto shrink-0" fill="none" strokeWidth="14">
        <path d={RIBBON} strokeWidth="12" className="stroke-marker" />
        <path d={AA} stroke="currentColor" strokeLinejoin="round" />
      </svg>
      <span className="font-display text-[1em] font-semibold tracking-[-.03em]">AAcademy</span>
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
