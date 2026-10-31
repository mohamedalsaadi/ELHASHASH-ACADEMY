import { StatusChip } from "@/components/ui/StatusChip";
import { Link } from "@/i18n/navigation";

/** A live session in any list. Only the `now` phase gets the pen border and an action. */
export function LiveRow({
  href,
  title,
  subtitle,
  when,
  phase,
  phaseLabel,
  action,
}: {
  href?: string;
  title: string;
  subtitle?: string;
  when: string;
  phase: "now" | "soon" | "later";
  phaseLabel: string;
  action?: React.ReactNode;
}) {
  const tone = phase === "now" ? "live" : phase === "soon" ? "expiring" : "neutral";
  const body = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="grid min-w-0 gap-0.5">
        <StatusChip tone={tone}>{phaseLabel}</StatusChip>
        <span className="mt-1 flex min-w-0 items-center gap-2 font-medium">
          {/* The red dot marks every live row; it pulses only while the room is open. */}
          <span
            aria-hidden="true"
            className={`size-2 shrink-0 rounded-full bg-down ${phase === "now" ? "animate-pulse motion-reduce:animate-none" : ""}`}
          />
          <span className="truncate">{title}</span>
        </span>
        <span className="num text-label text-ink-muted">{when}</span>
        {subtitle && <span className="truncate text-label text-ink-muted">{subtitle}</span>}
      </span>
      {action && <span className="shrink-0 text-small">{action}</span>}
    </div>
  );

  const className = `grid gap-2 rounded-md border p-4 ${phase === "now" ? "border-pen bg-surface" : "border-hairline bg-surface"}`;
  if (!href) return <div className={className}>{body}</div>;
  return (
    <Link href={href} className={`${className} transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised`}>
      {body}
    </Link>
  );
}
