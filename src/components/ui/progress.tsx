/** Progress, drawn the way DESIGN.md asks: a bar that always carries its value, and a row of small A's. */

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
        <span className="block h-full rounded-full bg-marker" style={{ width: `${pct}%` }} />
      </span>
      <span className="num text-label text-ink-muted" dir="ltr">
        {done} / {total} · {pct}%
      </span>
    </div>
  );
}

export type MarkState = "done" | "current" | "ahead";

/** One lesson as an A: done lapis, current gold, ahead faint. */
export function LessonMark({ state }: { state: MarkState }) {
  const tone = state === "done" ? "bg-pen" : state === "current" ? "bg-marker" : "bg-field/35";
  return <span aria-hidden="true" className={`inline-block h-4 w-3 shrink-0 [clip-path:polygon(50%_0,100%_100%,0_100%)] ${tone}`} />;
}

export function LessonMarks({ states, label }: { states: MarkState[]; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-wrap items-end gap-1">
      {states.map((state, i) => (
        <li key={i}>
          <LessonMark state={state} />
        </li>
      ))}
    </ol>
  );
}
