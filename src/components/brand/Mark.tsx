// The brand mark: a ring (ink) tangent to an amber horizon. Geometry lives on a 48 grid; see DESIGN.md §0.
export const RING_PATH = "M24 9a11 11 0 1 1 0 22a11 11 0 1 1 0-22";
// The horizon draws from the inline start, so RTL starts on the right.
export const horizonPath = (rtl: boolean) => (rtl ? "M43 31H5" : "M5 31H43");

export function Mark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d={RING_PATH} fill="none" strokeWidth="3" className="stroke-ink" />
      <path d="M43 31H5" fill="none" strokeWidth="3" strokeLinecap="round" className="stroke-amber" />
      <circle cx="24" cy="31" r="2.6" className="fill-amber" />
    </svg>
  );
}

/** Wordmark. Arabic puts the amber on the name; English keeps ACADEMY in amber. */
export function Wordmark({ locale, className = "" }: { locale: string; className?: string }) {
  return locale === "ar" ? (
    <span className={`whitespace-nowrap font-display font-bold ${className}`}>
      أكاديمية <span className="text-amber">الحشاش</span>
    </span>
  ) : (
    <span className={`whitespace-nowrap font-display font-bold tracking-[.08em] ${className}`}>
      ELHASHASH <span className="text-amber">ACADEMY</span>
    </span>
  );
}

/** Empty state: the ring has not reached the horizon yet, and nothing is amber. */
export function EmptyMark({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="15" r="9" fill="none" strokeWidth="2.5" className="stroke-field" />
      <path d="M43 31H5" strokeWidth="2.5" strokeLinecap="round" className="stroke-hairline" />
    </svg>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-md border border-hairline bg-surface p-6 text-center">
      <EmptyMark />
      {children}
    </div>
  );
}
