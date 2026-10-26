import { Lock } from "lucide-react";
import { LessonMark } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";

export type LessonRowState = "done" | "current" | "open" | "lockedPlan" | "locked";

/** One lesson in a list: the mark says where it stands, the row says what it is, `trailing` says what you can do. */
export function LessonRow({
  href,
  title,
  subtitle,
  state,
  trailing,
  active = false,
}: {
  href?: string;
  title: string;
  subtitle?: string;
  state: LessonRowState;
  trailing?: React.ReactNode;
  active?: boolean;
}) {
  const locked = state === "locked" || state === "lockedPlan";
  const body = (
    <>
      <span className="flex min-w-0 items-center gap-2.5">
        {locked ? (
          <Lock aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
        ) : (
          <LessonMark state={state === "done" ? "done" : state === "current" ? "current" : "ahead"} />
        )}
        <span className="grid min-w-0 gap-0.5">
          <span className="truncate font-medium">{title}</span>
          {subtitle && <span className="truncate text-label text-ink-muted">{subtitle}</span>}
        </span>
      </span>
      {trailing && <span className="shrink-0 text-small">{trailing}</span>}
    </>
  );

  const className = `flex items-center justify-between gap-3 border-t border-hairline px-2 py-3 first:border-t-0 ${active ? "bg-raised" : ""}`;

  if (!href || locked) return <div className={className}>{body}</div>;
  return (
    <Link href={href} className={`${className} transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised`}>
      {body}
    </Link>
  );
}
