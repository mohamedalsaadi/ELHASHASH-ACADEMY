// The home hero summit (DESIGN.md §6). Contour rings of one terrain fade in flat like a map, lift to their heights while
// the camera tilts, a summit-gold trail climbs from the foot to the top and a flag settles there. Framework-free:
// Summit.tsx owns the lifecycle. The name is DOM text over the canvas, never drawn here.
import type * as Three from "three";

export const SUMMIT_END = 4.0;

export type SummitColors = { ramp: string[]; summit: string; snow: string };

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

// The terrain: one dominant summit and two lower shoulders, with a little ripple so the rings read as land, not targets.
const SX = 0.1, SZ = -0.05, HEIGHT = 0.62;
const height = (x: number, z: number) =>
  Math.exp(-((x - SX) ** 2 + (z - SZ) ** 2) / 0.3) +
  0.38 * Math.exp(-((x + 0.62) ** 2 + (z - 0.5) ** 2) / 0.09) +
  0.26 * Math.exp(-((x - 0.7) ** 2 + (z - 0.62) ** 2) / 0.06) +
  0.03 * Math.sin(x * 7.1 + z * 3.3) * Math.cos(z * 6.2);

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

  // Contour rings, coloured up the elevation ramp; the highest ring is summit gold.
  const ramp = colors.ramp.map((c) => new THREE.Color(c));
  const rampAt = (f: number) => {
    const k = f * (ramp.length - 1), i = Math.min(ramp.length - 2, Math.floor(k));
    return ramp[i].clone().lerp(ramp[i + 1], k - i);
  };
  const LEVELS = small ? 11 : 14;
  const levelValues = Array.from({ length: LEVELS }, (_, l) => 0.06 + (l * (0.98 - 0.06)) / (LEVELS - 1));
  const rings = contours(small ? 100 : 150, 1.25, levelValues).map((pts, l) => {
    const geo = keep(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const color = l === LEVELS - 1 ? new THREE.Color(colors.summit) : rampAt(l / (LEVELS - 2));
    const mat = keep(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 }));
    const ring = new THREE.LineSegments(geo, mat);
    ring.userData.h = levelValues[l] * HEIGHT;
    scene.add(ring);
    return ring;
  });

  // The trail: spirals up from the foot to the summit, drawn by growing the tube's draw range.
  const path: Three.Vector3[] = [];
  for (let k = 0; k <= 220; k++) {
    const s = k / 220, th = 2.6 + s * Math.PI * 1.25, r = 0.95 * Math.pow(1 - s, 1.15);
    const x = SX + r * Math.cos(th), z = SZ + r * Math.sin(th) * 0.9;
    path.push(new THREE.Vector3(x, height(x, z) * HEIGHT + 0.012, z));
  }
  const tube = keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), 260, small ? 0.011 : 0.008, 6, false));
  const trail = new THREE.Mesh(tube, keep(new THREE.MeshBasicMaterial({ color: colors.summit })));
  const trailCount = tube.index!.count;
  scene.add(trail);

  // The flag on the summit: a snow pole, a gold pennant, a gold point at its foot.
  const top = path[path.length - 1];
  const flag = new THREE.Group();
  const pole = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 6)), keep(new THREE.MeshBasicMaterial({ color: colors.snow })));
  pole.position.y = 0.08;
  const pennantGeo = keep(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.16, 0), new THREE.Vector3(rtl ? -0.085 : 0.085, 0.135, 0), new THREE.Vector3(0, 0.11, 0)]));
  const gold = keep(new THREE.MeshBasicMaterial({ color: colors.summit, side: THREE.DoubleSide }));
  const point = new THREE.Mesh(keep(new THREE.SphereGeometry(0.016, 16, 12)), gold);
  flag.add(pole, new THREE.Mesh(pennantGeo, gold), point);
  flag.position.copy(top);
  scene.add(flag);

  // The terrain sits on the end side, opposite the copy. On a phone it sits above the copy, seen from farther away so
  // the whole peak fits the narrow frame.
  let distance = 1;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const wide = w >= 768;
    camera.fov = wide ? 36 : 50;
    distance = wide ? 1 : 1.9;
    if (wide) camera.setViewOffset(w, h, (rtl ? 1 : -1) * w * 0.2, -h * 0.1, w, h);
    else camera.setViewOffset(w, h, 0, h * 0.3, w, h);
    camera.updateProjectionMatrix();
  }
  resize();

  return {
    /** t: seconds since the intro started (≥ SUMMIT_END is the finished summit); now: seconds, for the idle drift (0 = none); px/py: pointer, -0.5..0.5. */
    render(t: number, now = 0, px = 0, py = 0) {
      const lift = seg(t, 0.6, 2.0);
      rings.forEach((ring, l) => {
        (ring.material as Three.LineBasicMaterial).opacity = 0.85 * seg(t, l * 0.04, 0.8);
        ring.position.y = ring.userData.h * lift;
      });
      trail.geometry.setDrawRange(0, Math.floor((trailCount * seg(t, 1.8, 1.6)) / 6) * 6);
      trail.scale.y = Math.max(lift, 1e-4);
      flag.scale.setScalar(Math.max(seg(t, 3.4, 0.4), 1e-4));
      flag.position.y = top.y * lift;

      const idle = t > SUMMIT_END ? Math.sin(now / 9) * 0.06 : 0;
      const az = 0.55 + idle + px * 0.1;
      const r = (3.3 - lift * 0.35) * distance, el = 0.03 + lift + py * 0.08;
      camera.position.set(r * Math.sin(el) * Math.sin(az), r * Math.cos(el), r * Math.sin(el) * Math.cos(az));
      camera.lookAt(0, 0.16 * lift, 0);
      renderer.render(scene, camera);
    },
    resize,
    dispose() {
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
}
