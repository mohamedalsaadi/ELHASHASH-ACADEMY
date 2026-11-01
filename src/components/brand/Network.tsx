// The network map: one line per country out of the A+ interchange, drawn at 0°, 45° and 90° only.
// An 800 × 500 board; every line runs straight from its edge point to the interchange at the centre.
// Lines with a published course are solid and may carry stations; the rest are dashed, under construction.

export type NetLine = { code: string; inService: boolean; stations?: { label: string; href?: string }[] };

const C = { x: 400, y: 250 };
// Edge points in catalogue order. The first and third slots are horizontal so station labels read level.
const SLOTS = [
  { x: 0, y: 250 },
  { x: 400, y: 0 },
  { x: 800, y: 250 },
  { x: 150, y: 0 },
  { x: 650, y: 0 },
  { x: 150, y: 500 },
  { x: 400, y: 500 },
];

const color = (code: string) => `var(--color-line-${code.toLowerCase()}, var(--color-field))`;

export function Network({ id, lines, label, className = "" }: { id: string; lines: NetLine[]; label?: string; className?: string }) {
  const placed = lines.slice(0, SLOTS.length).map((l, i) => ({ ...l, from: SLOTS[i] }));
  // A group, not an img: the stations inside are real links and must stay named and reachable.
  return (
    <svg viewBox="0 0 800 500" role={label ? "group" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={`net ${className}`}>
      <defs>
        {/* The reveal mask: every line drawn solid from its edge to the centre, so dashed lines draw in too. */}
        <mask id={`${id}-reveal`} maskUnits="userSpaceOnUse" x="0" y="0" width="800" height="500">
          {placed.map((l, i) => (
            <path key={l.code} d={`M${l.from.x} ${l.from.y}L${C.x} ${C.y}`} pathLength={1} className="net-draw" style={{ "--i": i } as React.CSSProperties} stroke="white" strokeWidth="20" fill="none" />
          ))}
        </mask>
      </defs>
      {/* One group per line, so hovering a line or one of its stations lights that whole line and dims the rest. */}
      {placed.map((l) => (
        <g key={l.code} data-line={l.code} className="net-line">
          <path
            d={`M${l.from.x} ${l.from.y}L${C.x} ${C.y}`}
            mask={`url(#${id}-reveal)`}
            fill="none"
            strokeWidth="12"
            style={{ stroke: color(l.code) }}
            strokeDasharray={l.inService ? undefined : "14 10"}
          />
          {(l.stations ?? []).map((s, j, all) => {
            // Stations sit evenly between the edge and the interchange, never on either end.
            const t = (j + 1) / (all.length + 1);
            const x = l.from.x + (C.x - l.from.x) * t;
            const y = l.from.y + (C.y - l.from.y) * t;
            const stop = (
              <>
                <circle cx={x} cy={y} r="9" className="fill-surface stroke-ink" strokeWidth="4" />
                <text x={x} y={j % 2 ? y + 44 : y - 24} textAnchor="middle" className="net-label fill-ink font-display font-semibold">
                  {s.label}
                </text>
              </>
            );
            return s.href ? (
              <a key={j} href={s.href} aria-label={s.label}>
                {stop}
              </a>
            ) : (
              <g key={j}>{stop}</g>
            );
          })}
        </g>
      ))}
      <g className="net-hub">
        <circle cx={C.x} cy={C.y} r="26" className="fill-surface stroke-ink" strokeWidth="8" />
        <text x={C.x} y={C.y + 8} textAnchor="middle" direction="ltr" className="net-hub-label fill-ink font-display font-bold">
          A+
        </text>
      </g>
    </svg>
  );
}

// Line colours too light for white type (tokens.css).
const INK_ON = new Set(["BH"]);

/** A country's line sign: its code on a block of its line colour, the way platform signs name a line. */
export function LineBadge({ code, className = "size-11" }: { code: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center font-display text-small font-bold ${INK_ON.has(code) ? "text-ink" : "text-on-primary"} ${className}`}
      style={{ background: color(code) }}
    >
      {code}
    </span>
  );
}
