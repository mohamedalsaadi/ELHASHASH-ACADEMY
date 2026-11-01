// The brand: an A routed like a metro line, and a + where the Egypt and UAE lines cross at a roundel. See DESIGN.md §0.
// Geometry lives in brand-svg.ts so the generated icons and this component never drift. Ink is currentColor.
import { A_PATH, MARK_VIEWBOX, PLUS_H, PLUS_V, ROUNDEL } from "@/app/brand-svg";

function Glyph({ className = "", ...rest }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox={MARK_VIEWBOX} aria-hidden="true" fill="none" strokeWidth="6" className={`shrink-0 ${className}`} {...rest}>
      <path d={A_PATH} stroke="currentColor" />
      <path d={PLUS_H} className="stroke-line-eg" />
      <path d={PLUS_V} className="stroke-line-ae" />
      <circle {...ROUNDEL} className="fill-surface" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

/** The A+ mark: favicons, small badges, seals. */
export function Mark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return <Glyph width={size} height={(size * 48) / 64} className={className} />;
}

/** The wordmark: the mark plus "A+ Academy" in Alexandria; Latin in both locales. */
export function Wordmark({ className = "" }: { locale?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[.36em] leading-none ${className}`} dir="ltr">
      <Glyph className="h-[1.1em] w-auto" />
      <span className="font-display text-[1em] font-bold tracking-[-.02em]">A+ Academy</span>
    </span>
  );
}

/** Empty state: the A drawn dashed, a line still under construction. */
export function EmptyMark({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 48) / 64} viewBox={MARK_VIEWBOX} aria-hidden="true" fill="none" strokeWidth="4" strokeDasharray="6 5" className="stroke-field">
      <path d={A_PATH} />
    </svg>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-lg border border-dashed border-rule bg-surface p-8 text-center">
      <EmptyMark />
      {children}
    </div>
  );
}
