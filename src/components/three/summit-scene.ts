// The home hero intro (DESIGN.md §6): the brand logo itself, drawn in 3D. The three ridge lines of the mark are drawn
// one after another, exactly as in brand-svg.ts, then the gold summit sphere is born at the peak and settles on its
// point above them. Rounded, softly lit, nothing else. Framework-free: Summit.tsx owns the lifecycle.
import type * as Three from "three";
import { RIDGES, RIDGE_WIDTH, SUMMIT } from "@/app/brand-svg";

export const SUMMIT_END = 4.0;

export type SummitColors = { line: string; summit: string };

// cubic-bezier(.16,1,.3,1), the brand easing (--ease-out), solved by Newton steps.
const easeOut = (() => {
  const [x1, y1, x2, y2] = [0.16, 1, 0.3, 1];
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t: number) => ((ax * t + bx) * t + cx) * t;
  const Y = (t: number) => ((ay * t + by) * t + cy) * t;
  const dX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = dX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= (X(t) - x) / d;
    }
    return Y(Math.min(1, Math.max(0, t)));
  };
})();
const seg = (t: number, start: number, dur: number) => easeOut((t - start) / dur);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
// A hair of overshoot, for the summit's landing.
const backOut = (x: number) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);

// The mark's own grid (64 × 48, y down) to scene units: centred on the logo, y up, 1 grid unit = S.
const S = 0.05;
const sx = (x: number) => (x - 32) * S;
const sy = (y: number) => (24 - y) * S;
const RADIUS = (RIDGE_WIDTH / 2) * S;
const RADIAL = 14;

/** A ridge path ("M x y C … C …") as a curve in scene space. */
function ridgeCurve(THREE: typeof Three, d: string) {
  const n = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  const path = new THREE.CurvePath<Three.Vector3>();
  const p = (i: number) => new THREE.Vector3(sx(n[i]), sy(n[i + 1]), 0);
  for (let i = 2; i + 5 < n.length; i += 6) path.add(new THREE.CubicBezierCurve3(i === 2 ? p(0) : p(i - 2), p(i), p(i + 2), p(i + 4)));
  return path;
}

export function createSummit(
  THREE: typeof Three,
  canvas: HTMLCanvasElement,
  opts: { rtl: boolean; small: boolean; colors: SummitColors },
) {
  const { rtl, small, colors } = opts;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  const camera = new THREE.PerspectiveCamera(24, 1, 0.05, 50);
  const scene = new THREE.Scene();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  const C = (hex: string) => new THREE.Color(hex);

  // Soft studio light: a cool sky fill, a warm key from above the summit side, a pale rim from behind.
  scene.add(new THREE.HemisphereLight(C(colors.line), C("#172840"), 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(rtl ? -1.5 : 1.5, 2.5, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(C(colors.line), 1.2);
  rim.position.set(rtl ? 2 : -2, 1, -3);
  scene.add(rim);

  const mark = new THREE.Group();
  scene.add(mark);

  // The three ridges: round tubes at the logo's own stroke weight, a round cap at each end, drawn by growing the index range.
  const lineMat = keep(new THREE.MeshStandardMaterial({ color: C(colors.line), roughness: 0.38, metalness: 0.05, emissive: C(colors.line), emissiveIntensity: 0.12 }));
  const capGeo = keep(new THREE.SphereGeometry(RADIUS, 20, 14));
  const ridges = RIDGES.map((d) => {
    const curve = ridgeCurve(THREE, d);
    const geo = keep(new THREE.TubeGeometry(curve, 240, RADIUS, RADIAL, false));
    const tube = new THREE.Mesh(geo, lineMat);
    const start = new THREE.Mesh(capGeo, lineMat);
    const head = new THREE.Mesh(capGeo, lineMat);
    start.position.copy(curve.getPointAt(0));
    mark.add(tube, start, head);
    return { curve, geo, tube, start, head, count: geo.index!.count };
  });

  // The summit: one glossy gold sphere, exactly the mark's point.
  const gold = C(colors.summit);
  const ball = new THREE.Mesh(
    keep(new THREE.SphereGeometry(SUMMIT.r * S, 48, 32)),
    keep(new THREE.MeshPhysicalMaterial({ color: gold, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.2, emissive: gold, emissiveIntensity: 0.38 })),
  );
  mark.add(ball);
  const bornY = sy(15), homeY = sy(SUMMIT.cy);

  // Framing: measure the free part of the hero beside the copy (the end side on a wide screen, the band above it on a
  // phone), fit the logo's bounding circle into it, and shift the view so the circle's centre lands there.
  let distance = 5;
  const R = 1.55;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const box = canvas.getBoundingClientRect();
    const copy = canvas.parentElement?.querySelector(".as-hero-copy")?.getBoundingClientRect();
    const wide = w >= 768 && w / h > 0.9;
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    const freeW = copy ? (rtl ? copy.left - box.left : box.right - copy.right) : w * 0.44;
    const freeH = copy ? copy.top - box.top : h * 0.4;
    const rw = wide ? clamp(freeW - 32, w * 0.34, w * 0.6) : w * 0.9;
    const rh = wide ? h * 0.8 : clamp(freeH - 12, h * 0.25, h * 0.5);
    const cx = wide ? (rtl ? rw / 2 + 16 : w - rw / 2 - 16) : w / 2;
    const cy = wide ? h * 0.47 : rh / 2 + 6;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    distance = R / Math.sin(Math.atan(Math.min(tanV * (rh / h), tanV * camera.aspect * (rw / w))));
    camera.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h);
    camera.updateProjectionMatrix();
  }
  resize();

  return {
    /** t: seconds since the intro started (≥ SUMMIT_END is the finished logo); now: seconds, for the idle breathing (0 = none); px/py: pointer, -0.5..0.5. */
    render(t: number, now = 0, px = 0, py = 0) {
      // Ridges: outer first, 0.3 s apart.
      ridges.forEach((r, i) => {
        const p = seg(t, 0.15 + i * 0.3, 1.2);
        const per = RADIAL * 6;
        r.geo.setDrawRange(0, Math.floor((r.count * p) / per) * per);
        r.start.visible = p > 0;
        r.head.visible = p > 0;
        r.head.position.copy(r.curve.getPointAt(Math.min(1, p)));
      });
      // One soft glow across the lines before the summit is born.
      lineMat.emissiveIntensity = 0.12 + 0.34 * Math.sin(Math.PI * clamp01((t - 2.0) / 0.8));

      // The summit: born at the outer peak, stretches up to its point, a hair of overshoot, a small squash on landing.
      const u = clamp01((t - 2.4) / 1.1);
      const e = seg(t, 2.4, 1.1);
      ball.visible = u > 0;
      const stretch = u < 0.7 ? Math.sin(Math.PI * (u / 0.7)) * 0.2 : 0;
      const squash = u >= 0.7 ? Math.sin(Math.PI * ((u - 0.7) / 0.3)) * 0.08 : 0;
      const grow = Math.max(0.01, 0.25 + 0.75 * e);
      const breathe = t > SUMMIT_END ? 1 + 0.02 * Math.sin(now * 1.25) : 1;
      ball.scale.set(grow * (1 - stretch * 0.5 + squash * 0.6) * breathe, grow * (1 + stretch - squash) * breathe, grow * breathe);
      ball.position.set(0, bornY + (homeY - bornY) * backOut(e) + (t > SUMMIT_END ? 0.012 * Math.sin(now * 1.25 + 1) : 0), 0);

      // Camera: a quarter turn off-axis that settles to the front as the lines finish; then a slow drift and the pointer.
      const settle = 1 - seg(t, 0.2, 2.2);
      const az = 0.32 * settle + (t > SUMMIT_END ? Math.sin(now / 8) * 0.04 : 0) + px * 0.2;
      const el = 0.14 * settle + py * 0.12;
      camera.position.set(distance * Math.sin(az) * Math.cos(el), distance * Math.sin(el), distance * Math.cos(az) * Math.cos(el));
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    },
    resize,
    dispose() {
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
}
