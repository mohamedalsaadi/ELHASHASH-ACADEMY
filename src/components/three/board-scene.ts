// The home hero board. The slate itself is CSS (.stage in brand.css); this scene adds what happens on it: a stick of
// chalk draws four lessons a teacher would put on the board (axes and a parabola, a wave, a benzene ring) and then
// writes the name and underlines it, shedding dust as it goes. Chalk motes drift in the classroom light afterwards,
// a little parallax on the pointer giving the room its depth. Framework-free; `render(t, now, px, py)` draws story time
// `t` (past BOARD_END the drawing is complete) with `now` driving the idle motes.
import type * as Three from "three";

/** Length of the intro story, seconds. The hero copy rises at 3.2 s (brand.css). */
export const BOARD_END = 4.2;

export type BoardColors = { chalk: string[] }; // chalk-1..6 from tokens.css: yellow, orange, pink, blue, green, white

type Pt = [number, number];
type Stroke = { pts: Pt[]; color: string; width: number; t0: number; t1: number; done: number; seed: number };
type Word = { text: string; rtl: boolean; color: string; t0: number; t1: number; at: Pt; size: number; shown: number; img?: HTMLCanvasElement };

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
// A hand speeds up through a stroke and slows into its end.
const hand = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

/** Small seeded PRNG (mulberry32): the chalk grain is the same on every redraw. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One chalk segment: a few uneven passes, then specks knocked out of it where the chalk skipped on the slate. */
function chalkSegment(g: CanvasRenderingContext2D, a: Pt, b: Pt, w: number, color: string, r: () => number) {
  g.strokeStyle = color;
  g.lineCap = "round";
  for (let pass = 0; pass < 3; pass++) {
    const j = () => (r() - 0.5) * w * 0.45;
    g.globalAlpha = 0.3 + 0.4 * r();
    g.lineWidth = w * (0.55 + 0.5 * r());
    g.beginPath();
    g.moveTo(a[0] + j(), a[1] + j());
    g.lineTo(b[0] + j(), b[1] + j());
    g.stroke();
  }
  grain(g, a, b, w, r);
  g.globalAlpha = 1;
}

function grain(g: CanvasRenderingContext2D, a: Pt, b: Pt, w: number, r: () => number) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  g.globalCompositeOperation = "destination-out";
  for (let k = 0, n = Math.ceil(len * 1.2); k < n; k++) {
    const f = r();
    const s = 0.6 + r() * 1.2;
    g.globalAlpha = 0.4 + 0.6 * r();
    g.fillRect(a[0] + (b[0] - a[0]) * f + (r() - 0.5) * w * 1.2, a[1] + (b[1] - a[1]) * f + (r() - 0.5) * w * 1.2, s, s);
  }
  g.globalCompositeOperation = "source-over";
}

/** The word in chalk, rendered once offscreen (rough double pass plus grain) and then revealed in writing direction. */
function wordImage(word: Word, font: string, pr: number) {
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = `700 ${word.size}px ${font}`;
  const w = Math.ceil(probe.measureText(word.text).width + word.size * 0.4), h = Math.ceil(word.size * 1.7);
  const c = document.createElement("canvas");
  c.width = Math.ceil(w * pr);
  c.height = Math.ceil(h * pr);
  const g = c.getContext("2d")!;
  g.scale(pr, pr);
  g.font = probe.font;
  g.direction = word.rtl ? "rtl" : "ltr";
  g.textAlign = word.rtl ? "right" : "left";
  g.fillStyle = word.color;
  const x = word.rtl ? w - word.size * 0.2 : word.size * 0.2, y = word.size * 1.15;
  g.globalAlpha = 0.85;
  g.fillText(word.text, x, y);
  g.globalAlpha = 0.35;
  g.fillText(word.text, x + word.size * 0.012, y - word.size * 0.01);
  const r = rng(77);
  g.globalCompositeOperation = "destination-out";
  for (let k = 0, n = Math.round(w * h * 0.09); k < n; k++) {
    g.globalAlpha = 0.3 + 0.7 * r();
    const s = 0.5 + r() * 1.3;
    g.fillRect(r() * w, r() * h, s, s);
  }
  return c;
}

export function createBoard(
  THREE: typeof Three,
  canvas: HTMLCanvasElement,
  opts: { rtl: boolean; small: boolean; word: string; wordRtl: boolean; font: string; colors: BoardColors },
) {
  const { rtl, small, colors } = opts;
  const [yellow, , pink, blue, green, white] = colors.chalk;
  const pr = Math.min(devicePixelRatio, small ? 1.5 : 2);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(pr);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  const scene = new THREE.Scene();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  // The chalk layer: a canvas texture on a plane that exactly fills the view at z = 0, over the CSS slate.
  const layer = document.createElement("canvas");
  const g = layer.getContext("2d")!;
  const tex = keep(new THREE.CanvasTexture(layer));
  tex.colorSpace = THREE.SRGBColorSpace;
  const planeGeo = keep(new THREE.PlaneGeometry(1, 1));
  const plane = new THREE.Mesh(planeGeo, keep(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })));
  scene.add(plane);

  // Dust: soft round sprites, additive, faded by colour. Shed motes fall from the chalk tip; idle motes drift in the
  // light in three depth layers that slide by different amounts with the pointer.
  const dot = document.createElement("canvas");
  dot.width = dot.height = 32;
  const dg = dot.getContext("2d")!;
  const rad = dg.createRadialGradient(16, 16, 0, 16, 16, 16);
  rad.addColorStop(0, "rgba(255,255,255,1)");
  rad.addColorStop(1, "rgba(255,255,255,0)");
  dg.fillStyle = rad;
  dg.fillRect(0, 0, 32, 32);
  const sprite = keep(new THREE.CanvasTexture(dot));
  const dustMat = (size: number) =>
    keep(new THREE.PointsMaterial({ size, map: sprite, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));

  const SHED = 500;
  const shed = { pos: new Float32Array(SHED * 3), col: new Float32Array(SHED * 3), vel: new Float32Array(SHED * 3), life: new Float32Array(SHED), max: new Float32Array(SHED), next: 0 };
  const shedGeo = keep(new THREE.BufferGeometry());
  shedGeo.setAttribute("position", new THREE.BufferAttribute(shed.pos, 3));
  shedGeo.setAttribute("color", new THREE.BufferAttribute(shed.col, 3));
  const shedPts = new THREE.Points(shedGeo, dustMat(small ? 0.05 : 0.04));
  shedPts.frustumCulled = false;
  scene.add(shedPts);

  const chalkWhite = new THREE.Color(white);
  const layers = [0.6, 1.4, 2.4].map((depth, li) => {
    const n = small ? 14 : 26;
    const base = new Float32Array(n * 3), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), phase = new Float32Array(n);
    const r = rng(11 + li);
    for (let i = 0; i < n; i++) {
      base.set([(r() - 0.5) * 9, (r() - 0.5) * 5, depth + r() * 0.5], i * 3);
      phase[i] = r() * Math.PI * 2;
    }
    const geo = keep(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, dustMat(0.03 + li * 0.012));
    pts.frustumCulled = false;
    scene.add(pts);
    return { depth, n, base, pos, col, phase, geo, pts };
  });

  let W = 1, H = 1, viewW = 1, viewH = 1;
  let strokes: Stroke[] = [];
  let words: Word[] = [];
  let lastT = -1;

  /** css px on the board → world units on the z = 0 plane. */
  const world = (p: Pt) => new THREE.Vector3((p[0] / W - 0.5) * viewW, (0.5 - p[1] / H) * viewH, 0);

  // The lessons, laid out in a box on the end side (above the copy on a phone), mirrored for Arabic.
  function compose() {
    const box = small
      ? { x: W * 0.06, y: W * 0.04, w: W * 0.88, h: W * 0.44 } // ends above the copy, which starts at 52vw (page.tsx)
      : { x: rtl ? W * 0.04 : W * 0.5, y: H * 0.12, w: W * 0.46, h: H * 0.7 };
    const at = (x: number, y: number): Pt => [box.x + x * box.w, box.y + y * box.h];
    // Arabic swaps the two columns so the name sits next to the copy; the diagrams themselves are never mirrored
    // (an x axis points right in every language).
    const A = rtl ? 0.52 : 0, B = rtl ? -0.52 : 0;
    const u = Math.min(box.w, box.h * 1.4); // a length unit that keeps circles round
    const w = Math.max(2.2, u * 0.0085);
    const line = (pts: Pt[], color: string, t0: number, t1: number, width = w): Stroke => ({ pts, color, width, t0, t1, done: 0, seed: 0 });
    const sample = (n: number, f: (s: number) => Pt) => Array.from({ length: n + 1 }, (_, i) => f(i / n));
    strokes = [];
    const push = (s: Stroke) => strokes.push({ ...s, seed: strokes.length * 97 + 13 });

    // Axes with arrowheads, then the parabola y = x² (yellow).
    const ox = A + 0.24, oy = 0.5;
    push(line(sample(24, (s) => at(A + 0.01 + s * 0.46, oy)), white, 0.15, 0.4));
    push(line(sample(24, (s) => at(ox, 0.56 - s * 0.55)), white, 0.38, 0.62));
    const head = 0.018 * (box.h / box.w);
    push(line([at(A + 0.45, oy - 0.025), at(A + 0.47, oy), at(A + 0.45, oy + 0.025)], white, 0.62, 0.68));
    push(line([at(ox - head * 1.4, 0.035), at(ox, 0.01), at(ox + head * 1.4, 0.035)], white, 0.66, 0.72));
    push(line(sample(48, (s) => { const x = A + 0.05 + s * 0.38; return at(x, 0.42 - 0.36 * ((x - ox) / 0.19) ** 2); }), yellow, 0.72, 1.4, w * 1.15));
    // A wave (blue) with its wavelength marked.
    push(line(sample(72, (s) => at(B + 0.54 + s * 0.44, 0.2 - 0.09 * Math.sin(s * Math.PI * 3))), blue, 1.3, 2.05, w * 1.1));
    push(line([at(B + 0.595, 0.34), at(B + 0.883, 0.34)], pink, 2.05, 2.25, w * 0.8));
    // The benzene ring (green): six sides, then the circle inside.
    const c = at(B + 0.76, 0.6), R = u * 0.12;
    push(line(sample(6, (s) => [c[0] + R * Math.cos(s * Math.PI * 2 - Math.PI / 2), c[1] + R * Math.sin(s * Math.PI * 2 - Math.PI / 2)]), green, 2.1, 2.75, w * 1.1));
    push(line(sample(40, (s) => [c[0] + R * 0.55 * Math.cos(s * Math.PI * 2), c[1] + R * 0.55 * Math.sin(s * Math.PI * 2)]), green, 2.75, 3.05, w * 0.9));

    // The name, then its yellow underline in writing direction.
    const size = Math.min(u * 0.2, box.w * 0.22);
    const word: Word = { text: opts.word, rtl: opts.wordRtl, color: white, t0: 3.0, t1: 3.85, at: at(rtl ? 0.64 : 0.36, 0.8), size, shown: 0 };
    word.img = wordImage(word, opts.font, pr);
    // A Latin name runs much wider than سبّورة: keep it to half the box so it never reaches the copy.
    if (word.img.width / pr > box.w * 0.5) {
      word.size *= (box.w * 0.5) / (word.img.width / pr);
      word.img = wordImage(word, opts.font, pr);
    }
    const ww = word.img.width / pr, wh = word.img.height / pr;
    word.at = [word.at[0] - ww / 2, Math.min(word.at[1] - wh * 0.55, box.y + box.h - wh)];
    words = [word];
    const ux0 = word.at[0] + word.size * 0.25, ux1 = word.at[0] + ww - word.size * 0.25, uy = word.at[1] + wh * 0.88;
    push(line(sample(30, (s) => { const f = word.rtl ? 1 - s : s; return [ux0 + (ux1 - ux0) * f, uy + Math.sin(f * Math.PI * 2.2) * word.size * 0.03]; }), yellow, 3.85, 4.15, w * 1.3));
  }

  function spawn(at: Pt, count: number, r: () => number) {
    const p = world(at);
    for (let k = 0; k < count; k++) {
      const i = shed.next;
      shed.next = (shed.next + 1) % SHED;
      shed.pos.set([p.x + (r() - 0.5) * 0.04, p.y + (r() - 0.5) * 0.04, 0.02], i * 3);
      shed.vel.set([(r() - 0.5) * 0.25, -0.05 - r() * 0.25, 0.1 + r() * 0.5], i * 3);
      shed.max[i] = shed.life[i] = 0.7 + r() * 1.2;
    }
  }

  /** Draw every stroke and the word up to story time t. Incremental: only the new part is drawn each frame. */
  function draw(t: number, live: boolean) {
    g.setTransform(pr, 0, 0, pr, 0, 0);
    for (const s of strokes) {
      const n = s.pts.length - 1;
      const target = Math.floor(hand(span(t, s.t0, s.t1)) * n + 1e-6);
      if (target <= s.done) continue;
      const r = rng(s.seed + s.done * 31);
      for (let i = s.done; i < target; i++) chalkSegment(g, s.pts[i], s.pts[i + 1], s.width, s.color, r);
      s.done = target;
      if (live && t < s.t1) spawn(s.pts[target], 3, r);
    }
    for (const word of words) {
      if (!word.img) continue;
      const iw = word.img.width, ih = word.img.height;
      const f = hand(span(t, word.t0, word.t1));
      if (f <= word.shown) continue;
      const a = Math.floor(word.shown * iw), b = Math.ceil(f * iw);
      const sx = word.rtl ? iw - b : a, sw = b - a;
      g.drawImage(word.img, sx, 0, sw, ih, word.at[0] + sx / pr, word.at[1], sw / pr, ih / pr);
      word.shown = f;
      if (live && t < word.t1) spawn([word.at[0] + (word.rtl ? iw - b : b) / pr, word.at[1] + (ih / pr) * 0.6], 4, rng(b));
    }
    tex.needsUpdate = true;
  }

  function resize() {
    W = Math.max(canvas.clientWidth, 1);
    H = Math.max(canvas.clientHeight, 1);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    viewH = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
    viewW = viewH * camera.aspect;
    plane.scale.set(viewW, viewH, 1);
    layer.width = Math.round(W * pr);
    layer.height = Math.round(H * pr);
    compose();
    if (lastT >= 0) draw(lastT, false);
  }
  resize();

  let lastNow = 0;
  return {
    render(t: number, now: number, px = 0, py = 0) {
      const live = t >= lastT && t - lastT < 0.25; // a jump (skip, first frame) draws without shedding dust
      draw(t, live);
      lastT = t;
      const dt = lastNow ? Math.min(0.05, now - lastNow) : 0;
      lastNow = now;

      for (let i = 0; i < SHED; i++) {
        if (shed.life[i] <= 0) {
          shed.col[i * 3] = shed.col[i * 3 + 1] = shed.col[i * 3 + 2] = 0;
          continue;
        }
        shed.life[i] -= dt;
        shed.vel[i * 3 + 1] -= 0.35 * dt; // chalk dust is light: it sinks slowly
        for (let k = 0; k < 3; k++) shed.pos[i * 3 + k] += shed.vel[i * 3 + k] * dt;
        const a = Math.max(shed.life[i] / shed.max[i], 0) * 0.9;
        shed.col.set([chalkWhite.r * a, chalkWhite.g * a, chalkWhite.b * a], i * 3);
      }
      shedGeo.attributes.position.needsUpdate = true;
      shedGeo.attributes.color.needsUpdate = true;

      // Idle motes fade in once the drawing is done and drift in slow loops.
      const idle = clamp01((t - BOARD_END + 0.6) / 1.2) * (now ? 1 : 0);
      for (const l of layers) {
        for (let i = 0; i < l.n; i++) {
          const ph = l.phase[i] + now * 0.15;
          l.pos.set([l.base[i * 3] + Math.sin(ph) * 0.25, l.base[i * 3 + 1] + Math.cos(ph * 0.7) * 0.18, l.base[i * 3 + 2]], i * 3);
          const a = idle * (0.25 + 0.25 * Math.sin(ph * 2.3)) * (0.5 + l.depth * 0.2);
          l.col.set([chalkWhite.r * a, chalkWhite.g * a, chalkWhite.b * a], i * 3);
        }
        l.pts.position.set(-px * l.depth * 0.18, py * l.depth * 0.12, 0);
        l.geo.attributes.position.needsUpdate = true;
        l.geo.attributes.color.needsUpdate = true;
      }
      renderer.render(scene, camera);
    },
    resize,
    dispose() {
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
}
