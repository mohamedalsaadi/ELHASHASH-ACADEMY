// The brand mark: the letter ح inside a red marking circle, with a tick. 48 grid; see DESIGN.md §0.
// The letter is Alexandria 800 outlined to a path, so it renders the same before and without web fonts.
export const HA_PATH =
  "M26.7 22.1V19.1Q26.7 18.3 26.3 17.8Q25.8 17.2 24.9 16.9Q24.1 16.6 22.8 16.6Q21.9 16.6 21 16.8Q20.1 17 19.4 17.2L17.7 13.4Q18.9 12.7 20.2 12.4Q21.5 12 22.8 12Q24.4 12 25.8 12.5Q27.2 12.9 28.3 13.8Q29.4 14.7 30 16Q30.6 17.4 30.6 19.1V22.1ZM24.1 34Q22.7 34 21.3 33.6Q20 33.2 18.9 32.3Q17.8 31.5 17.2 30.3Q16.6 29.1 16.6 27.6Q16.6 26.3 17.1 25Q17.6 23.8 18.7 22.8Q19.7 21.8 21.3 21.2Q22.9 20.6 25 20.6V25.1Q23.6 25.1 22.6 25.5Q21.6 25.9 21 26.4Q20.5 26.9 20.5 27.5Q20.5 28 20.9 28.5Q21.3 28.9 22.1 29.1Q22.9 29.4 24.1 29.4Q24.7 29.4 25.3 29.4Q25.8 29.3 26.4 29.2L27.8 33.3Q26.9 33.7 26 33.8Q25 34 24.1 34ZM25 25.1V20.6H31.4L30.6 25.1Z";
// Hand-drawn circle that does not quite close, like a teacher's pen.
export const CIRCLE_PATH = "M24 4c11 0 20 8.5 20 19.5 0 11.5-9.5 20.5-21 20.5C12 44 4 35 4 24 4 13.5 12 5 22 4";
export const TICK_PATH = "M32 36l3.5 3.5L43 30";

export function Mark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d={CIRCLE_PATH} fill="none" strokeWidth="2.6" strokeLinecap="round" className="stroke-pen" />
      <path d={HA_PATH} className="fill-ink" />
      <path d={TICK_PATH} fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="stroke-pen" />
    </svg>
  );
}

/** Wordmark: Arabic stacks "أكاديمية" over the name; English is one line. */
export function Wordmark({ locale, className = "" }: { locale: string; className?: string }) {
  return locale === "ar" ? (
    <span className={`grid gap-0.5 whitespace-nowrap font-display leading-[1.1] ${className}`}>
      <span className="text-[.6em] font-semibold text-ink-muted">أكاديمية</span>
      <span className="font-extrabold">الحشاش</span>
    </span>
  ) : (
    <span className={`whitespace-nowrap font-display font-extrabold tracking-[.04em] ${className}`}>
      ELHASHASH <span className="font-semibold text-ink-muted">ACADEMY</span>
    </span>
  );
}

/** Empty state: a blank answer sheet, the circle drawn in pencil grey and no mark yet. */
export function EmptyMark({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path d={CIRCLE_PATH} fill="none" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 4" className="stroke-field" />
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
