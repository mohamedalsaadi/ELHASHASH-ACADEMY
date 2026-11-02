// The brand: a slate board on its ledge with a stick of yellow chalk, and one chalk stroke writing س. See DESIGN.md §0.
// Geometry lives in brand-svg.ts so the generated icons and this component never drift.
import { BOARD, CHALK, LEDGE, MARK_VIEWBOX, SEEN } from "@/app/brand-svg";

function Glyph({ className = "", ...rest }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox={MARK_VIEWBOX} aria-hidden="true" fill="none" className={`shrink-0 ${className}`} {...rest}>
      <rect {...BOARD} className="fill-night" />
      <path d={SEEN} className="stroke-chalk-6" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d={LEDGE} className="stroke-wood" strokeWidth="4" strokeLinecap="round" />
      <rect {...CHALK} className="fill-chalk-1" />
    </svg>
  );
}

/** The board mark: favicons, small badges, seals. */
export function Mark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return <Glyph width={size} height={(size * 48) / 64} className={className} />;
}

/** The wordmark: the board plus the name, سبّورة in Ruqʿah (the script teachers write on the board) in Arabic, Sabboura in English. */
export function Wordmark({ locale = "ar", className = "" }: { locale?: string; className?: string }) {
  const ar = locale === "ar";
  return (
    <span className={`inline-flex items-center gap-[.36em] leading-none ${className}`} dir={ar ? "rtl" : "ltr"}>
      <Glyph className="h-[1.1em] w-auto" />
      {ar ? (
        <span lang="ar" className="font-hand text-[1.18em] font-bold">
          سبّورة
        </span>
      ) : (
        <span className="font-display text-[1em] font-bold tracking-[-.02em]">Sabboura</span>
      )}
    </span>
  );
}

/** Empty state: a clean board, the chalk stroke still dashed, nothing written yet. */
export function EmptyMark({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 48) / 64} viewBox={MARK_VIEWBOX} aria-hidden="true" fill="none" strokeWidth="3" strokeDasharray="5 4" strokeLinecap="round" className="stroke-field">
      <path d={SEEN} />
      <path d={LEDGE} />
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
