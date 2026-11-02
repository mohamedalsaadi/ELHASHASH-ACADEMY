// The home hero summit (DESIGN.md §6), drawn minimally: a few thin snow contour lines fade in flat like a map, lift to
// their heights while the camera tilts, and only the top one is summit gold. A fine gold trail climbs to the summit
// and one gold point settles there. Framework-free: Summit.tsx owns the lifecycle. The name is DOM text, never drawn.
import type * as Three from "three";

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

// The terrain: one dominant summit and one lower shoulder, with only a trace of ripple so the lines stay clean.
const SX = 0.1, SZ = -0.05, HEIGHT = 0.95;
const height = (x: number, z: number) =>
  Math.exp(-((x - SX) ** 2 + (z - SZ) ** 2) / 0.24) +
  0.34 * Math.exp(-((x + 0.62) ** 2 + (z - 0.5) ** 2) / 0.09) +
  0.012 * Math.sin(x * 7.1 + z * 3.3) * Math.cos(z * 6.2);

/** Marching squares over the height grid: one flat set of line segments per contour level, at y = 0. */
function contours(n: number, span: number, levels: number[]) {
  const g = new Float32Array((n + 1) * (n + 1));
  const at = (i: number) => -span + (2 * span * i) / n;
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) g[j * (n + 1) + i] = height(at(i), at(j));
  const v = (i: number, j: number) => g[j * (n + 1) + i];
  return levels.map((L) => {
    const pts: number[] = [];
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
        const hit: number[] = [];
        for (let e = 0; e < 4; e++) {
          const [a, b] = [c[e], c[(e + 1) % 4]];
          const va = v(a[0], a[1]) - L, vb = v(b[0], b[1]) - L;
          if (va < 0 !== vb < 0) {
            const t = va / (va - vb);
            hit.push(at(a[0] + (b[0] - a[0]) * t), 0, at(a[1] + (b[1] - a[1]) * t));
          }
        }
        if (hit.length >= 6) pts.push(...hit.slice(0, 6));
        if (hit.length === 12) pts.push(...hit.slice(6, 12));
      }
    return pts;
  });
}

export function createSummit(
  THREE: typeof Three,
  canvas: HTMLCanvasElement,
  opts: { rtl: boolean; small: boolean; colors: SummitColors },
) {
  const { rtl, small, colors } = opts;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 50);
  const scene = new THREE.Scene();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  // Few lines, one colour: snow, fainter low and clearer high. Only the highest line is summit gold.
  const LEVELS = small ? 6 : 8;
  const levelValues = Array.from({ length: LEVELS }, (_, l) => 0.1 + (l * (0.94 - 0.1)) / (LEVELS - 1));
  const rings = contours(small ? 100 : 150, 1.25, levelValues).map((pts, l) => {
    const geo = keep(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const top = l === LEVELS - 1;
    const mat = keep(new THREE.LineBasicMaterial({ color: top ? colors.summit : colors.line, transparent: true, opacity: 0 }));
    const ring = new THREE.LineSegments(geo, mat);
    ring.userData = { h: levelValues[l] * HEIGHT, alpha: top ? 0.95 : 0.16 + 0.44 * (l / (LEVELS - 2)) };
    scene.add(ring);
    return ring;
  });

  // The trail: a fine gold line curving up from the foot to the summit in one gentle turn, drawn by growing its range.
  const path: Three.Vector3[] = [];
  for (let k = 0; k <= 220; k++) {
    const s = k / 220, th = 2.5 + s * Math.PI * 0.6, r = 0.95 * Math.pow(1 - s, 1.15);
    const x = SX + r * Math.cos(th), z = SZ + r * Math.sin(th) * 0.9;
    path.push(new THREE.Vector3(x, height(x, z) * HEIGHT + 0.01, z));
  }
  const tube = keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), 260, small ? 0.007 : 0.005, 6, false));
  const gold = keep(new THREE.MeshBasicMaterial({ color: colors.summit }));
  const trail = new THREE.Mesh(tube, gold);
  const trailCount = tube.index!.count;
  scene.add(trail);

  // The summit: one gold point.
  const top = path[path.length - 1];
  const point = new THREE.Mesh(keep(new THREE.SphereGeometry(small ? 0.024 : 0.018, 16, 12)), gold);
  scene.add(point);

  // Framing: measure the free part of the hero beside the copy (the end side on a wide screen, the band above it on a
  // phone), fit the terrain's bounding sphere into it, and shift the view so the sphere's centre lands there.
  let distance = 4;
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
    const rw = wide ? clamp(freeW - 32, w * 0.34, w * 0.6) : w * 0.94;
    const rh = wide ? h * 0.86 : clamp(freeH - 12, h * 0.25, h * 0.5);
    const cx = wide ? (rtl ? rw / 2 + 16 : w - rw / 2 - 16) : w / 2;
    const cy = wide ? h * 0.47 : rh / 2 + 6;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    distance = (wide ? 1.05 : 0.92) / Math.sin(Math.atan(Math.min(tanV * (rh / h), tanV * camera.aspect * (rw / w))));
    camera.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h);
    camera.updateProjectionMatrix();
  }
  resize();

  return {
    /** t: seconds since the intro started (≥ SUMMIT_END is the finished summit); now: seconds, for the idle drift (0 = none); px/py: pointer, -0.5..0.5. */
    render(t: number, now = 0, px = 0, py = 0) {
      const lift = seg(t, 0.6, 2.0);
      rings.forEach((ring, l) => {
        (ring.material as Three.LineBasicMaterial).opacity = ring.userData.alpha * seg(t, l * 0.06, 0.8);
        ring.position.y = ring.userData.h * lift;
      });
      trail.geometry.setDrawRange(0, Math.floor((trailCount * seg(t, 1.8, 1.6)) / 6) * 6);
      trail.scale.y = Math.max(lift, 1e-4);
      point.scale.setScalar(Math.max(seg(t, 3.3, 0.5), 1e-4));
      point.position.set(top.x, top.y * lift, top.z);

      const idle = t > SUMMIT_END ? Math.sin(now / 9) * 0.05 : 0;
      const az = 0.55 + idle + px * 0.08;
      const el = 0.03 + lift + py * 0.06;
      const target = 0.2 * lift;
      camera.position.set(distance * Math.sin(el) * Math.sin(az), target + distance * Math.cos(el), distance * Math.sin(el) * Math.cos(az));
      camera.lookAt(0, target, 0);
      renderer.render(scene, camera);
    },
    resize,
    dispose() {
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
}
