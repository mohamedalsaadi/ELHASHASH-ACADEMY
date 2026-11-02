// Home intro, option B "Dawn Relief" (under review against summit-scene.ts). A solid relief mountain at first light:
// the dawn rises, contour lines draw up its slopes in a shader, the camera arcs to three-quarter view, a summit-gold
// route traces the ridge to the top and one gold ring pulses there once. Same {render, resize, dispose} shape and the
// same 4 s timeline as the Contour scene, so Summit.tsx, Intro.tsx and brand.css serve both.
import type * as Three from "three";
import { SUMMIT_END } from "./summit-scene";

export type DawnColors = { ramp: string[]; summit: string; snow: string; night: string };

// cubic-bezier(.16,1,.3,1), the brand easing, as in summit-scene.ts.
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

// One clear peak, a long ridge running down to the start side and a lower shoulder, with a little ripple so the
// slopes read as rock; it falls to zero at the rim so the relief floats on the night map.
const PX = 0.05, PZ = -0.05, HEIGHT = 0.85, SPAN = 1.3;
const raw = (x: number, z: number) =>
  Math.exp(-((x - PX) ** 2 + (z - PZ) ** 2) / 0.16) +
  0.36 * Math.exp(-(((x + 0.5) ** 2) / 0.12 + ((z - 0.34) ** 2) / 0.04)) +
  0.2 * Math.exp(-(((x - 0.55) ** 2) / 0.04 + ((z - 0.45) ** 2) / 0.08)) +
  0.035 * Math.sin(x * 6.3 + z * 2.7) * Math.cos(z * 5.1 - x * 1.3);
const rim = (x: number, z: number) => {
  const r = Math.hypot(x, z) / SPAN;
  return r >= 1 ? 0 : 1 - (r < 0.7 ? 0 : ((r - 0.7) / 0.3) ** 2 * (3 - 2 * ((r - 0.7) / 0.3)));
};
const TOP = raw(PX, PZ);
const height = (x: number, z: number) => (Math.max(0, raw(x, z)) / TOP) * rim(x, z);

const vertex = /* glsl */ `
  varying float vH;
  varying float vR;
  varying vec3 vN;
  uniform float uHeight;
  void main() {
    vH = position.y / uHeight;
    vR = length(position.xz);
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const fragment = /* glsl */ `
  varying float vH;
  varying float vR;
  varying vec3 vN;
  uniform vec3 uRamp[5];
  uniform vec3 uGold;
  uniform vec3 uSnow;
  uniform vec3 uNight;
  uniform vec3 uLight;
  uniform float uDawn;
  uniform float uReveal;
  uniform float uSpan;
  const float LEVELS = 13.0;
  vec3 ramp(float h) {
    float k = clamp(h, 0.0, 1.0) * 4.0;
    int i = int(min(floor(k), 3.0));
    float f = k - float(i);
    vec3 a = uRamp[0], b = uRamp[1];
    if (i == 1) { a = uRamp[1]; b = uRamp[2]; }
    if (i == 2) { a = uRamp[2]; b = uRamp[3]; }
    if (i == 3) { a = uRamp[3]; b = uRamp[4]; }
    return mix(a, b, f);
  }
  void main() {
    float lit = max(dot(normalize(vN), normalize(uLight)), 0.0);
    // Rock: the night map lifted toward the elevation ramp, lit low from the dawn side.
    vec3 rock = mix(uNight, ramp(vH), 0.42 + 0.38 * vH);
    vec3 col = rock * (0.5 + 0.8 * lit * uDawn) + uGold * pow(lit, 3.0) * 0.32 * uDawn;
    col = mix(col, uSnow * (0.6 + 0.4 * lit), smoothstep(0.93, 1.0, vH) * 0.5 * uDawn);
    // Contour lines on the surface, drawn upward as the dawn reveal climbs; the top line is summit gold.
    float f = vH * LEVELS;
    float d = abs(fract(f - 0.5) - 0.5) / max(fwidth(f), 1e-4);
    float line = 1.0 - smoothstep(0.6, 1.6, d);
    float shown = 1.0 - smoothstep(uReveal - 0.04, uReveal, vH);
    vec3 lineCol = floor(f + 0.5) >= LEVELS - 1.0 ? uGold : ramp(vH + 0.15);
    float drawn = line * shown * step(0.02, vH);
    col = mix(col, lineCol, drawn * 0.8);
    // The low ground is only its contour lines; the rock rises out of the map with the height, and fades at the rim.
    float body = smoothstep(0.04, 0.3, vH);
    float a = max(body, drawn * 0.85) * (1.0 - smoothstep(0.78, 1.0, vR / uSpan));
    gl_FragColor = vec4(col, a);
  }
`;

export function createDawn(THREE: typeof Three, canvas: HTMLCanvasElement, opts: { rtl: boolean; small: boolean; colors: DawnColors }) {
  const { rtl, small, colors } = opts;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 50);
  const scene = new THREE.Scene();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  // The relief: one displaced plane, normals recomputed for the light.
  const n = small ? 120 : 200;
  const geo = keep(new THREE.PlaneGeometry(SPAN * 2, SPAN * 2, n, n));
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as Three.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)) * HEIGHT);
  geo.computeVertexNormals();
  const uniforms = {
    uRamp: { value: colors.ramp.map((c) => new THREE.Color(c)) },
    uGold: { value: new THREE.Color(colors.summit) },
    uSnow: { value: new THREE.Color(colors.snow) },
    uNight: { value: new THREE.Color(colors.night) },
    uLight: { value: new THREE.Vector3(1, 0.1, 0.4) },
    uDawn: { value: 0 },
    uReveal: { value: 0 },
    uHeight: { value: HEIGHT },
    uSpan: { value: SPAN },
  };
  const relief = new THREE.Mesh(geo, keep(new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms, transparent: true })));
  scene.add(relief);

  // The route: up the long ridge from its foot to the summit.
  const ridge = [[-0.86, 0.58], [-0.66, 0.46], [-0.46, 0.33], [-0.28, 0.2], [-0.1, 0.06], [PX, PZ]].map(
    ([x, z]) => new THREE.Vector3(x, 0, z),
  );
  const flat = new THREE.CatmullRomCurve3(ridge).getPoints(200);
  const route = flat.map((p) => new THREE.Vector3(p.x, height(p.x, p.z) * HEIGHT + 0.012, p.z));
  const tube = keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(route), 240, small ? 0.012 : 0.009, 6, false));
  const gold = keep(new THREE.MeshBasicMaterial({ color: colors.summit }));
  const trail = new THREE.Mesh(tube, gold);
  const trailCount = tube.index!.count;
  scene.add(trail);

  // The summit: a gold point and one ring that pulses out once.
  const top = route[route.length - 1];
  const point = new THREE.Mesh(keep(new THREE.SphereGeometry(0.02, 16, 12)), gold);
  point.position.copy(top);
  scene.add(point);
  const ringMat = keep(new THREE.MeshBasicMaterial({ color: colors.summit, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  const ring = new THREE.Mesh(keep(new THREE.RingGeometry(0.94, 1, 64)), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(top);
  scene.add(ring);

  // Framing: measure the free part of the hero beside the copy (the end side on a wide screen, the band above it on a
  // phone), fit the relief's bounding sphere into it, and shift the view so the sphere's centre lands there.
  const target = new THREE.Vector3(0, HEIGHT * 0.3, 0);
  const RADIUS = 1.12;
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
    const fit = Math.min(tanV * (rh / h), tanV * camera.aspect * (rw / w));
    distance = RADIUS / Math.sin(Math.atan(fit));
    camera.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h);
    camera.updateProjectionMatrix();
  }
  resize();

  return {
    /** t: seconds since the intro started (≥ SUMMIT_END is the finished frame); now: seconds, for the idle drift; px/py: pointer, -0.5..0.5. */
    render(t: number, now = 0, px = 0, py = 0) {
      const dawn = seg(t, 0, 1.4);
      const el = 0.06 + dawn * 0.5;
      uniforms.uLight.value.set(Math.cos(el) * Math.sin(1.05), Math.sin(el), Math.cos(el) * Math.cos(1.05));
      uniforms.uDawn.value = 0.35 + 0.65 * dawn;
      uniforms.uReveal.value = 1.05 * seg(t, 0.2, 1.6);
      trail.geometry.setDrawRange(0, Math.floor((trailCount * seg(t, 1.8, 1.6)) / 6) * 6);
      point.scale.setScalar(Math.max(seg(t, 3.2, 0.4), 1e-4));
      const pulse = Math.min(1, Math.max(0, (t - 3.4) / 0.6));
      ring.scale.setScalar(0.02 + 0.42 * easeOut(pulse));
      ringMat.opacity = pulse > 0 && pulse < 1 ? 0.9 * (1 - pulse) : 0;

      const arc = seg(t, 0.8, 2.2);
      const idle = t > SUMMIT_END ? Math.sin(now / 9) * 0.06 : 0;
      const az = 1.3 - arc * 0.7 + idle + px * 0.1;
      const polar = 1.38 - arc * 0.36 + py * 0.06;
      camera.position.set(
        target.x + distance * Math.sin(polar) * Math.sin(az),
        target.y + distance * Math.cos(polar),
        target.z + distance * Math.sin(polar) * Math.cos(az),
      );
      camera.lookAt(target);
      renderer.render(scene, camera);
    },
    resize,
    dispose() {
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
}
