/** Progress, drawn the way DESIGN.md asks: a trail-green bar that always carries its value, and a row of small peaks. */

export function ProgressBar({
  done,
  total,
  label,
  className = "",
}: {
  done: number;
  total: number;
  label: string;
  className?: string;
}) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className={`grid gap-1 ${className}`}>
      <span
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} / ${total}`}
        aria-label={label}
        className="block h-1 w-full overflow-hidden rounded-full bg-raised"
      >
        <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </span>
      <span className="num text-label text-ink-muted" dir="ltr">
        {done} / {total} · {pct}%
      </span>
    </div>
  );
}

export type MarkState = "done" | "current" | "ahead";

/** One lesson as a small peak: done trail green, current trail green and taller (state in form, not colour alone), ahead faint. */
export function LessonMark({ state, label }: { state: MarkState; label?: string }) {
  const tone = state === "done" ? "h-4 bg-pen" : state === "current" ? "h-5 bg-pen" : "h-4 bg-field/35";
  return (
    <>
      <span aria-hidden="true" className={`inline-block w-3 shrink-0 [clip-path:polygon(50%_0,100%_100%,0_100%)] ${tone}`} />
      {label && <span className="sr-only">{label}</span>}
    </>
  );
}
