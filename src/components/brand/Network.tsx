// The trail map: one trail per country, winding up from its trailhead at the edge of an 800 × 500 survey sheet to the
// summit at the centre, over still contour rings. Trails with something published are solid and may carry waypoints;
// the rest are dashed, still being cut. Every trail and waypoint comes from the catalogue.

export type NetLine = { code: string; inService: boolean; stations?: { label: string; href?: string }[] };

const C = { x: 400, y: 250 };
// Trailheads in catalogue order. The first and third sit on the side edges so waypoint labels read level.
const SLOTS = [
  { x: 0, y: 250 },
  { x: 400, y: 0 },
  { x: 800, y: 250 },
  { x: 150, y: 0 },
  { x: 650, y: 0 },
  { x: 150, y: 500 },
  { x: 400, y: 500 },
];
// Contour rings round the summit, outer (low ground) to inner (high ground).
const RINGS = [
  { rx: 370, ry: 230, tone: "stroke-contour-4" },
  { rx: 280, ry: 172, tone: "stroke-contour-4" },
  { rx: 190, ry: 118, tone: "stroke-contour-3" },
  { rx: 105, ry: 66, tone: "stroke-contour-3" },
];

const color = (code: string) => `var(--color-line-${code.toLowerCase()}, var(--color-field))`;

/** A trail bends to one side of the straight line, alternating per trail, so neighbours never overlap. */
function bend(from: { x: number; y: number }, i: number) {
  const dx = C.x - from.x;
  const dy = C.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const k = (i % 2 ? -1 : 1) * 0.18 * len;
  return { x: (from.x + C.x) / 2 + (-dy / len) * k, y: (from.y + C.y) / 2 + (dx / len) * k };
}

/** A point on the quadratic trail, t = 0 at the trailhead, 1 at the summit. */
function at(from: { x: number; y: number }, q: { x: number; y: number }, t: number) {
  const u = 1 - t;
  return { x: u * u * from.x + 2 * u * t * q.x + t * t * C.x, y: u * u * from.y + 2 * u * t * q.y + t * t * C.y };
}

export function Network({ lines, label, className = "" }: { lines: NetLine[]; label?: string; className?: string }) {
  const placed = lines.slice(0, SLOTS.length).map((l, i) => ({ ...l, from: SLOTS[i], q: bend(SLOTS[i], i) }));
  // A group, not an img: the waypoints inside are real links and must stay named and reachable.
  return (
    <svg viewBox="0 0 800 500" role={label ? "group" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={`net ${className}`}>
      <g aria-hidden="true" fill="none" strokeWidth="1.5">
        {RINGS.map((r) => (
          <ellipse key={r.rx} cx={C.x} cy={C.y} rx={r.rx} ry={r.ry} className={r.tone} />
        ))}
      </g>
      {/* One group per trail, so hovering a trail or one of its waypoints lights that whole trail and dims the rest. */}
      {placed.map((l) => (
        <g key={l.code} data-line={l.code} className="net-line">
          <path
            d={`M${l.from.x} ${l.from.y}Q${l.q.x} ${l.q.y} ${C.x} ${C.y}`}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            style={{ stroke: color(l.code) }}
            strokeDasharray={l.inService ? undefined : "2 14"}
          />
          {(l.stations ?? []).map((s, j, all) => {
            // Waypoints sit evenly between the trailhead and the summit, never on either end.
            const p = at(l.from, l.q, (j + 1) / (all.length + 1));
            const stop = (
              <>
                <circle cx={p.x} cy={p.y} r="10" className="fill-surface" strokeWidth="5" style={{ stroke: color(l.code) }} />
                <text
                  x={p.x}
                  y={j % 2 ? p.y + 44 : p.y - 24}
                  textAnchor="middle"
                  paintOrder="stroke"
                  strokeWidth="8"
                  strokeLinejoin="round"
                  className="net-label fill-ink stroke-ground font-display font-semibold"
                >
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
      {/* The summit point. */}
      <circle aria-hidden="true" cx={C.x} cy={C.y} r="12" className="fill-summit stroke-surface" strokeWidth="4" />
    </svg>
  );
}

// Line colours too light for white type (tokens.css).
const INK_ON = new Set(["BH"]);

/** A country's trail sign: its code on a roundel of its trail colour. */
export function LineBadge({ code, className = "size-11" }: { code: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full font-display text-small font-bold ${INK_ON.has(code) ? "text-ink" : "text-on-primary"} ${className}`}
      style={{ background: color(code) }}
    >
      {code}
    </span>
  );
}
