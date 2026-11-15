import type { Point } from "@/lib/insights";

// Charts for the owner's Insights page. Plain SVG and HTML, drawn on the server: no chart library, no client script.
// Colours are theme tokens, so both themes work. Each chart carries a text summary (<title> and aria-label) and the page
// puts the same numbers in tables where the exact values matter.

const nf = new Intl.NumberFormat("en-GB");
export const fmt = (n: number) => nf.format(Math.round(n));

/** The next round number above max, so the top gridline is a clean value. */
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 5, 10]) if (max <= m * p) return m * p;
  return 10 * p;
}

const W = 640;
const H = 180;
const PAD = { l: 8, r: 8, t: 20, b: 30 };

/** One value per day as a line over a soft area; the last point is marked in summit gold. */
export function LineChart({ points, label, format = fmt }: { points: Point[]; label: string; format?: (n: number) => string }) {
  const max = niceMax(Math.max(0, ...points.map((p) => p.n)));
  const total = points.reduce((a, p) => a + p.n, 0);
  const x = (i: number) => PAD.l + (points.length <= 1 ? 0 : (i / (points.length - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.n).toFixed(1)}`).join(" ");
  const area = points.length ? `${line} L${x(points.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z` : "";
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${format(total)}`} className="h-auto w-full" style={{ direction: "ltr" }}>
      <title>{`${label}: ${format(total)}`}</title>
      {[0, 0.5, 1].map((f) => (
        <line key={f} x1={PAD.l} x2={W - PAD.r} y1={y(max * f)} y2={y(max * f)} stroke="var(--color-hairline)" strokeWidth={1} />
      ))}
      {area && <path d={area} fill="var(--color-raised)" />}
      {line && <path d={line} fill="none" stroke="var(--color-ink)" strokeWidth={2} strokeLinejoin="round" />}
      {last && points.length > 0 && <circle cx={x(points.length - 1)} cy={y(last.n)} r={4.5} fill="var(--color-summit)" stroke="var(--color-ink)" strokeWidth={1.5} />}
      <text x={PAD.l} y={15} fontSize={16} fill="var(--color-ink-muted)">{format(max)}</text>
      <text x={PAD.l} y={H - 9} fontSize={16} fill="var(--color-ink-muted)">{points[0]?.d.slice(5)}</text>
      <text x={W - PAD.r} y={H - 9} fontSize={16} fill="var(--color-ink-muted)" textAnchor="end">{last?.d.slice(5)}</text>
    </svg>
  );
}

/** A column per category (the 24 hours, or the weeks); the tallest is gold. */
export function Columns({ values, labels, label }: { values: number[]; labels: string[]; label: string }) {
  const max = niceMax(Math.max(0, ...values));
  const top = values.indexOf(Math.max(...values));
  const slot = (W - PAD.l - PAD.r) / Math.max(1, values.length);
  const bw = slot * 0.66;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${fmt(values.reduce((a, b) => a + b, 0))}`} className="h-auto w-full" style={{ direction: "ltr" }}>
      <title>{label}</title>
      <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="var(--color-hairline)" />
      {values.map((v, i) => {
        const h = (v / max) * (H - PAD.t - PAD.b);
        return <rect key={i} x={PAD.l + i * slot + (slot - bw) / 2} y={H - PAD.b - h} width={bw} height={Math.max(h, v > 0 ? 1 : 0)} rx={2} fill={i === top && v > 0 ? "var(--color-summit)" : "var(--color-ink)"} />;
      })}
      {labels.map((l, i) => (i % Math.ceil(labels.length / 8) === 0 ? <text key={i} x={PAD.l + i * slot + slot / 2} y={H - 9} fontSize={16} fill="var(--color-ink-muted)" textAnchor="middle">{l}</text> : null))}
      <text x={PAD.l} y={15} fontSize={16} fill="var(--color-ink-muted)">{fmt(max)}</text>
    </svg>
  );
}

/** Horizontal bars with the value at the end; `of` is the full scale (the largest value when omitted). */
export function HBars({ rows, of, empty }: { rows: { label: string; value: number; text?: string }[]; of?: number; empty: string }) {
  if (!rows.length || rows.every((r) => r.value === 0)) return <p className="text-small text-ink-muted">{empty}</p>;
  const scale = of ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="grid gap-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(6rem,10rem)_1fr_auto] items-center gap-3 text-small">
          <span className="truncate" dir="auto">{r.label}</span>
          <span className="h-3 rounded-sm bg-raised" aria-hidden="true">
            <span className="block h-full rounded-sm bg-ink" style={{ width: `${Math.min(100, (r.value / scale) * 100)}%` }} />
          </span>
          <span className="num text-ink-muted" dir="ltr">{r.text ?? fmt(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

export function Kpi({ label, value, hint, alert }: { label: string; value: string; hint?: string; alert?: boolean }) {
  return (
    <div className={`grid gap-1 rounded-lg border p-4 ${alert ? "border-down" : "border-hairline"} bg-surface shadow-paper`}>
      <span className="text-label text-ink-muted">{label}</span>
      <span className="num font-display text-h2 font-semibold" dir="ltr">{value}</span>
      {hint && <span className="text-label text-ink-muted">{hint}</span>}
    </div>
  );
}
