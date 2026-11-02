// The home hero summit (DESIGN.md §6): one sculpted, softly lit mountain with a snow cap on a round plinth, like a
// product shot. It grows out of the flat map, a glowing climber walks a switchback trail to the top, and a gold flag is
// planted there and keeps waving. Framework-free: Summit.tsx owns the lifecycle. The name is DOM text, never drawn.
import type * as Three from "three";

export const SUMMIT_END = 4.0;

export type SummitColors = { low: string; mid: string; high: string; snow: string; summit: string; base: string };

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
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// The mountain, in polar form around its summit: one clear rounded peak, a few soft ridges, a low shoulder, and a
// foot that settles to the flat top of the plinth.
const R = 0.95, H = 1.15;
function height(r: number, th: number) {
  const x = r * Math.cos(th), z = r * Math.sin(th);
  const re = r * (1 + 0.1 * Math.sin(3 * th + 0.4) + 0.05 * Math.sin(5 * th + 2.1));
  const peak = 0.72 * Math.exp(-((re / 0.58) ** 2)) + 0.28 * Math.exp(-Math.pow(re / 0.3, 1.6));
  const shoulder = 0.26 * Math.exp(-((x + 0.4) ** 2 + (z - 0.32) ** 2) / 0.045);
  return H * (peak + shoulder) * (1 - smooth(0.82 * R, 0.995 * R, r));
}

export function createSummit(
  THREE: typeof Three,
  canvas: HTMLCanvasElement,
  opts: { rtl: boolean; small: boolean; colors: SummitColors },
) {
  const { rtl, small, colors } = opts;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  const scene = new THREE.Scene();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);
  const C = (hex: string) => new THREE.Color(hex);

  // Soft studio light: a cool sky fill, a warm key from the summit's side, and a pale rim from behind.
  scene.add(new THREE.HemisphereLight(C(colors.high), C(colors.base), 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(rtl ? -3 : 3, 2.2, 1.2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(C(colors.high), 2.2);
  rim.position.set(rtl ? 2 : -2, 1.5, -3);
  scene.add(rim);

  const world = new THREE.Group();
  scene.add(world);

  // The plinth: a thin round base, so the mountain reads as one object on the stage.
  const plinth = new THREE.Mesh(
    keep(new THREE.CylinderGeometry(R, R * 0.97, 0.1, 96, 1)),
    keep(new THREE.MeshStandardMaterial({ color: C(colors.base), roughness: 0.9 })),
  );
  plinth.position.y = -0.051;
  world.add(plinth);

  // The mountain: a polar grid (one centre vertex, then rings), coloured by height: rock low, snow on top.
  const NR = small ? 70 : 110, NS = small ? 120 : 180;
  const pos: number[] = [0, height(0, 0), 0];
  const col: number[] = [];
  const low = C(colors.low), mid = C(colors.mid), snow = C(colors.snow), tmp = new THREE.Color();
  const paint = (h: number, th: number) => {
    tmp.copy(low).lerp(mid, Math.pow(Math.min(1, h / (0.55 * H)), 0.8));
    const line = 0.62 * H + 0.04 * Math.sin(6 * th + 1) + 0.02 * Math.sin(11 * th);
    tmp.lerp(snow, smooth(line - 0.006, line + 0.006, h));
    col.push(tmp.r, tmp.g, tmp.b);
  };
  paint(height(0, 0), 0);
  for (let i = 1; i <= NR; i++)
    for (let j = 0; j < NS; j++) {
      const r = (R * i) / NR, th = (2 * Math.PI * j) / NS, h = height(r, th);
      pos.push(r * Math.cos(th), h, r * Math.sin(th));
      paint(h, th);
    }
  const idx: number[] = [];
  const v = (i: number, j: number) => (i === 0 ? 0 : 1 + (i - 1) * NS + (j % NS));
  for (let j = 0; j < NS; j++) idx.push(0, v(1, j + 1), v(1, j));
  for (let i = 1; i < NR; i++)
    for (let j = 0; j < NS; j++) idx.push(v(i, j), v(i, j + 1), v(i + 1, j), v(i, j + 1), v(i + 1, j + 1), v(i + 1, j));
  const geo = keep(new THREE.BufferGeometry());
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mountain = new THREE.Group();
  mountain.add(new THREE.Mesh(geo, keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }))));
  world.add(mountain);

  // The trail: switchbacks up the face turned to the camera, narrowing to the summit, drawn behind the climber.
  const front = Math.atan2(Math.cos(0.5), Math.sin(0.5));
  const path: Three.Vector3[] = [];
  for (let k = 0; k <= 300; k++) {
    const s = k / 300, r = 0.86 * R * Math.pow(1 - s, 0.85);
    const th = front + 0.5 * Math.sin(s * Math.PI * 3.5) * (1 - s);
    path.push(new THREE.Vector3(r * Math.cos(th), height(r, th) + 0.012, r * Math.sin(th)));
  }
  const curve = new THREE.CatmullRomCurve3(path);
  const tube = keep(new THREE.TubeGeometry(curve, 400, small ? 0.009 : 0.007, 6, false));
  const gold = keep(new THREE.MeshBasicMaterial({ color: C(colors.summit) }));
  const trail = new THREE.Mesh(tube, gold);
  const trailCount = tube.index!.count;
  mountain.add(trail);

  const climber = new THREE.Mesh(keep(new THREE.SphereGeometry(small ? 0.03 : 0.024, 20, 14)), gold);
  const glow = new THREE.Mesh(
    keep(new THREE.SphereGeometry(small ? 0.07 : 0.056, 20, 14)),
    keep(new THREE.MeshBasicMaterial({ color: C(colors.summit), transparent: true, opacity: 0.25, depthWrite: false })),
  );
  climber.add(glow);
  mountain.add(climber);

  // The flag: a snow-white pole and a gold pennant that unfurls, then waves.
  const top = new THREE.Vector3(0, height(0, 0), 0);
  const flag = new THREE.Group();
  flag.position.copy(top);
  const POLE = 0.36, FW = 0.3, FH = 0.19;
  const pole = new THREE.Mesh(
    keep(new THREE.CylinderGeometry(0.011, 0.011, POLE, 12).translate(0, POLE / 2, 0)),
    keep(new THREE.MeshStandardMaterial({ color: C(colors.snow), roughness: 0.4 })),
  );
  const clothGeo = keep(new THREE.PlaneGeometry(FW, FH, 16, 4).translate(FW / 2, POLE - FH / 2, 0));
  const base = Float32Array.from(clothGeo.attributes.position.array);
  const cloth = new THREE.Mesh(
    clothGeo,
    keep(new THREE.MeshStandardMaterial({ color: C(colors.summit), roughness: 0.6, side: THREE.DoubleSide, emissive: C(colors.summit), emissiveIntensity: 0.25 })),
  );
  flag.add(pole, cloth);
  flag.rotation.y = 0.25;
  mountain.add(flag);

  // Framing: measure the free part of the hero beside the copy (the end side on a wide screen, the band above it on a
  // phone), fit the scene's bounding sphere into it, and shift the view so the sphere's centre lands there.
  let distance = 5;
  const CENTER_Y = 0.5;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const box = canvas.getBoundingClientRect();
    const copy = canvas.parentElement?.querySelector(".as-hero-copy")?.getBoundingClientRect();
    const wide = w >= 768 && w / h > 0.9;
    const clamp = (val: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, val));
    const freeW = copy ? (rtl ? copy.left - box.left : box.right - copy.right) : w * 0.44;
    const freeH = copy ? copy.top - box.top : h * 0.4;
    const rw = wide ? clamp(freeW - 32, w * 0.34, w * 0.6) : w * 0.94;
    const rh = wide ? h * 0.8 : clamp(freeH - 12, h * 0.25, h * 0.5);
    const cx = wide ? (rtl ? rw / 2 + 16 : w - rw / 2 - 16) : w / 2;
    const cy = wide ? h * 0.48 : rh / 2 + 6;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    distance = (wide ? 1.3 : 1.2) / Math.sin(Math.atan(Math.min(tanV * (rh / h), tanV * camera.aspect * (rw / w))));
    camera.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h);
    camera.updateProjectionMatrix();
  }
  resize();

  const p = new THREE.Vector3();
  return {
    /** t: seconds since the intro started (≥ SUMMIT_END is the finished summit); now: seconds, for the idle motion (0 = none); px/py: pointer, -0.5..0.5. */
    render(t: number, now = 0, px = 0, py = 0) {
      const rise = seg(t, 0, 1.3);
      mountain.scale.y = Math.max(rise, 1e-3);
      world.position.y = -0.12 * (1 - rise);

      const climb = seg(t, 0.9, 2.2);
      trail.geometry.setDrawRange(0, Math.floor((trailCount * climb) / 6) * 6);
      curve.getPointAt(climb, p);
      climber.position.copy(p);
      climber.position.y += 0.02;
      climber.visible = t > 0.9 && t < 3.3;

      const plant = seg(t, 3.0, 0.4), unfurl = seg(t, 3.25, 0.6);
      pole.scale.y = Math.max(plant, 1e-3);
      cloth.scale.set(Math.max(unfurl, 1e-3), Math.max(unfurl, 1e-3), 1);
      // The pennant ripples more toward its free edge; still when there is no clock (reduced motion).
      const a = clothGeo.attributes.position as Three.BufferAttribute;
      for (let i = 0; i < a.count; i++) {
        const x = base[i * 3];
        a.setZ(i, now ? Math.sin(x * 22 - now * 4.5) * 0.022 * (x / FW) : 0.012 * Math.sin(x * 18) * (x / FW));
      }
      a.needsUpdate = true;
      clothGeo.computeVertexNormals();

      const idle = t > SUMMIT_END ? Math.sin(now / 8) * 0.08 : 0;
      const az = 0.5 + 0.25 * (1 - rise) + idle + px * 0.12;
      const el = 1.14 - 0.12 * (1 - rise) + py * 0.06;
      camera.position.set(
        distance * Math.sin(el) * Math.sin(az),
        CENTER_Y + distance * Math.cos(el),
        distance * Math.sin(el) * Math.cos(az),
      );
      camera.lookAt(0, CENTER_Y, 0);
      renderer.render(scene, camera);
    },
    resize,
    dispose() {
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
}
