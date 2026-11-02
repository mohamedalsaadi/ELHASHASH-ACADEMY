// The brand: three ridge lines closing in on one peak, and the summit-gold point that is also the dot of ذ. See DESIGN.md §0.
// Geometry lives in brand-svg.ts so the generated icons and this component never drift.
import { MARK_VIEWBOX, RIDGES, RIDGE_WIDTH, SUMMIT } from "@/app/brand-svg";

/** The ridges take the current text colour (ink on paper, snow on the map); the summit is always gold. */
function Glyph({ className = "", ...rest }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox={MARK_VIEWBOX} aria-hidden="true" fill="none" className={`shrink-0 ${className}`} {...rest}>
      <g stroke="currentColor" strokeWidth={RIDGE_WIDTH} strokeLinecap="round">
        {RIDGES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <circle {...SUMMIT} className="fill-summit" />
    </svg>
  );
}

/** The peak mark: favicons, small badges, seals. */
export function Mark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return <Glyph width={size} height={(size * 48) / 64} className={className} />;
}

/** The wordmark: the peak plus the name, ذروة in Reem Kufi in Arabic, Dhirwa in Readex Pro in English. */
export function Wordmark({ locale = "ar", className = "" }: { locale?: string; className?: string }) {
  const ar = locale === "ar";
  return (
    <span className={`inline-flex items-center gap-[.36em] leading-none ${className}`} dir={ar ? "rtl" : "ltr"}>
      <Glyph className="h-[1.1em] w-auto" />
      {ar ? (
        <span lang="ar" className="font-mark text-[1.12em] font-bold">
          ذروة
        </span>
      ) : (
        <span className="font-display text-[1em] font-bold tracking-[.04em]">Dhirwa</span>
      )}
    </span>
  );
}

/** Empty state: the ridges still dashed, the summit not yet reached. */
export function EmptyMark({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 48) / 64} viewBox={MARK_VIEWBOX} aria-hidden="true" fill="none" strokeWidth="3" strokeDasharray="5 4" strokeLinecap="round" className="stroke-field">
      {RIDGES.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-lg border border-dashed border-rule bg-surface/60 p-10 text-center">
      <EmptyMark />
      {children}
    </div>
  );
}
