// Line colours too light for white type (tokens.css).
const INK_ON = new Set(["BH"]);

/** A country's sign: its code on a roundel of its colour. */
export function LineBadge({ code, className = "size-11" }: { code: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full font-display text-small font-bold ${INK_ON.has(code) ? "text-on-summit" : "text-on-line"} ${className}`}
      style={{ background: `var(--color-line-${code.toLowerCase()}, var(--color-field))` }}
    >
      {code}
    </span>
  );
}
