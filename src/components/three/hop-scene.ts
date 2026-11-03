// The home hero intro, "Hop" (DESIGN.md §6): the flat brand mark, exactly as in the header. The three ridges draw out from the
// peak to their feet, then the gold point hops in from the start side, lands on the outer ridge, the ridges give under
// it like a springboard and launch it up to its place above them. Pure SVG: Summit.tsx owns the lifecycle.
import { RIDGES, SUMMIT } from "../../app/brand-svg";

export const SUMMIT_END = 4.0;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 4);
const easeInOut = (x: number) => (x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2);
const backOut = (x: number) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);
// A damped spring kicked at t = 0: the ridges' give and rebound after the landing.
const spring = (t: number) => (t <= 0 ? 0 : Math.sin(t * 2 * Math.PI * 3) * Math.exp(-t * 7));

// Each ridge as numbers: foot, two controls, peak, two controls, foot.
const NUM = RIDGES.map((d) => d.match(/-?\d+(?:\.\d+)?/g)!.map(Number));
/** One half of a ridge, drawn from the peak (pushed down by `dip`) out to its foot. */
const half = (n: number[], side: 0 | 1, dip: number) =>
  side === 0
    ? `M${n[6]} ${n[7] + dip}C${n[4]} ${n[5] + dip * 0.8} ${n[2]} ${n[3]} ${n[0]} ${n[1]}`
    : `M${n[6]} ${n[7] + dip}C${n[8]} ${n[9] + dip * 0.8} ${n[10]} ${n[11]} ${n[12]} ${n[13]}`;
export const HALVES = NUM.flatMap((n) => [half(n, 0, 0), half(n, 1, 0)]);
export const HOP_VIEWBOX = "-20 -12 104 60";

// Where the point rests on the outer ridge (peak minus half the stroke minus its radius), and where it starts.
const PEAK = NUM[0][7];
const REST = PEAK - 1.6 - SUMMIT.r;
const GROUND = 43 - SUMMIT.r;
const T = { land: 2.15, launch: 2.32 };

export function createHop(svg: SVGSVGElement, rtl: boolean) {
  const paths = [...svg.querySelectorAll<SVGPathElement>("[data-ridge]")];
  const dot = svg.querySelector<SVGEllipseElement>("[data-dot]")!;
  const ring = svg.querySelector<SVGCircleElement>("[data-ring]")!;
  const X = (x: number) => (rtl ? 64 - x : x);

  return {
    render(t: number, now = 0) {
      // Ridges: outer first, each from the peak out to both feet; after the landing they give and spring back.
      NUM.forEach((n, i) => {
        const p = easeInOut(clamp01((t - 0.1 - i * 0.14) / 0.9));
        const dip = t >= SUMMIT_END ? 0 : 2.4 * (1 - i * 0.3) * spring(t - T.land - i * 0.05);
        for (const side of [0, 1] as const) {
          const el = paths[i * 2 + side];
          el.setAttribute("d", half(n, side, dip));
          el.style.strokeDashoffset = String(1 - p);
          el.style.opacity = p > 0 ? "1" : "0";
        }
      });

      // The point: appears at the foot, crouches, hops in one arc, lands with a squash, rides the ridge down and is
      // launched to its place with a hair of overshoot, then floats.
      let x = -10, y = GROUND, sx = 1, sy = 1, rot = 0, o = 1;
      if (t < 1.3) {
        const a = easeOut((t - 1.0) / 0.3);
        o = a;
        sx = sy = 0.7 + 0.3 * a;
      } else if (t < 1.5) {
        const c = Math.sin(Math.PI * clamp01((t - 1.3) / 0.2));
        sx = 1 + 0.18 * c;
        sy = 1 - 0.22 * c;
        y = GROUND + SUMMIT.r * 0.22 * c;
      } else if (t < T.land) {
        const u = (t - 1.5) / (T.land - 1.5);
        x = -10 + (32 - -10) * u;
        // A parabola from the foot, over the peak, down onto the outer ridge.
        const H = 16;
        y = GROUND + (REST - GROUND) * u - 4 * H * u * (1 - u);
        const vx = 42, vy = REST - GROUND - 4 * H * (1 - 2 * u);
        rot = (Math.atan2(vy, vx) * 180) / Math.PI;
        const speed = Math.min(1, Math.hypot(vx, vy) / 80);
        sx = 1 + 0.22 * speed;
        sy = 1 - 0.14 * speed;
      } else if (t < T.launch) {
        const c = Math.sin(Math.PI * clamp01((t - T.land) / (T.launch - T.land)));
        x = 32;
        y = REST + 2.4 * spring(t - T.land);
        sx = 1 + 0.26 * c;
        sy = 1 - 0.3 * c;
      } else {
        const u = clamp01((t - T.launch) / 0.6);
        x = 32;
        y = REST + (SUMMIT.cy - REST) * backOut(u);
        const s = u < 0.4 ? Math.sin(Math.PI * (u / 0.4)) * 0.16 : 0;
        sx = 1 - s * 0.6;
        sy = 1 + s;
        if (t > SUMMIT_END) y += 0.35 * Math.sin(now * 1.2);
      }
      dot.setAttribute("cx", String(X(x)));
      dot.setAttribute("cy", String(y));
      dot.setAttribute("rx", String(SUMMIT.r * sx));
      dot.setAttribute("ry", String(SUMMIT.r * sy));
      dot.setAttribute("transform", rot ? `rotate(${rtl ? -rot : rot} ${X(x)} ${y})` : "");
      dot.style.opacity = String(o);

      // One soft ring when the point reaches its place.
      const r = clamp01((t - 2.8) / 0.8);
      ring.setAttribute("cy", String(y));
      ring.setAttribute("r", String(SUMMIT.r * (1 + 1.6 * easeOut(r))));
      ring.style.opacity = String(r > 0 && r < 1 ? 0.45 * (1 - r) : 0);
    },
  };
}
