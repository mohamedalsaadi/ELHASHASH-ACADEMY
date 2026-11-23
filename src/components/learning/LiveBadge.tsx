/**
 * The LIVE mark: a red pill with a pulsing dot. `soon` is the outlined, still dot before the stream starts.
 * State is in the word as well as the colour (DESIGN.md §2.4); the pulse stops under reduced motion.
 */
export function LiveBadge({ soon = false, className = "", children }: { soon?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-label font-bold tracking-wide ${soon ? "border border-down text-down" : "bg-down text-surface"} ${className}`}
    >
      <span aria-hidden="true" className={`size-2 rounded-full bg-current ${soon ? "" : "live-dot"}`} />
      {children}
    </span>
  );
}
