// The student home ride: one car per subject on a looping aurora rail. The cars move only when the student
// moves them (drag, sideways wheel, the subject buttons); the nearest car eases into the front "station".
// Timing follows the Aurora DNA: settle in about 700 ms on an ease-out, no bounce, no autoplay.
import type * as Three from "three";
import { subjectPaths } from "@/components/brand/SubjectIcon";

export type RideCar = { name: string; meta: string; price: string; icon: string };
export type RideColors = { rail: string[]; card: string; cardEdge: string; ink: string; muted: string; pen: string; glow: string };

/** Critically damped follow: about 95% of the way in 700 ms, whatever the frame rate. */
const follow = (dt: number) => 1 - Math.exp(-dt * 4.3);
const wrap = (x: number) => ((x % 1) + 1) % 1;
/** Shortest signed distance on the loop, in [-0.5, 0.5). */
const loopDelta = (from: number, to: number) => wrap(to - from + 0.5) - 0.5;

function carTexture(THREE: typeof Three, car: RideCar, c: RideColors, opts: { rtl: boolean; font: string; px: number }) {
  const w = opts.px, h = Math.round(opts.px * 1.25), s = w / 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d")!;
  const r = 28 * s, inset = 3 * s;
  const card = new Path2D();
  card.roundRect(inset, inset, w - 2 * inset, h - 2 * inset, r);
  g.fillStyle = c.card;
  g.fill(card);
  const edge = g.createLinearGradient(0, 0, w, h);
  c.rail.forEach((col, i) => edge.addColorStop(i / Math.max(1, c.rail.length - 1), col));
  g.lineWidth = 3 * s;
  g.strokeStyle = edge;
  g.stroke(card);

  // The subject icon, on the brand's 48 grid, ink strokes plus the pen stroke.
  const { ink, pen } = subjectPaths(car.icon);
  g.save();
  g.translate(w / 2 - 44 * s, 34 * s);
  g.scale((88 * s) / 48, (88 * s) / 48);
  g.lineWidth = 2.6;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = c.ink;
  g.stroke(new Path2D(ink));
  g.strokeStyle = c.pen;
  g.stroke(new Path2D(pen));
  g.restore();

  g.direction = opts.rtl ? "rtl" : "ltr";
  g.textAlign = "center";
  g.fillStyle = c.ink;
  g.font = `700 ${26 * s}px ${opts.font}`;
  g.fillText(car.name, w / 2, 168 * s, w - 32 * s);
  g.fillStyle = c.muted;
  g.font = `400 ${17 * s}px ${opts.font}`;
  g.fillText(car.meta, w / 2, 200 * s, w - 32 * s);
  if (car.price) {
    g.fillStyle = c.ink;
    g.font = `600 ${21 * s}px ${opts.font}`;
    g.fillText(car.price, w / 2, 262 * s, w - 32 * s);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createRide(
  THREE: typeof Three,
  canvas: HTMLCanvasElement,
  opts: { cars: RideCar[]; colors: RideColors; rtl: boolean; small: boolean; font: string },
) {
  const { cars, colors, rtl, small } = opts;
  const n = Math.max(cars.length, 1);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  const camera = new THREE.PerspectiveCamera(small ? 42 : 34, 1, 0.1, 100);
  const scene = new THREE.Scene();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  // The loop: wide and shallow, climbing to a hill on each side and dropping back to the station, like a ride.
  // u = 0 is the front-centre point nearest the camera: the station.
  const rx = small ? 3.1 : 5.4, rz = small ? 2.2 : 2.7;
  const points = Array.from({ length: 16 }, (_, k) => {
    const a = (k / 16) * Math.PI * 2;
    return new THREE.Vector3(rx * Math.sin(a) * (rtl ? -1 : 1), 0.85 * (1 - Math.cos(2 * a)) + 0.35 * Math.sin(3 * a), rz * Math.cos(a));
  });
  const curve = new THREE.CatmullRomCurve3(points, true, "centripetal");

  // The rail: a thin tube shaded along its length through the aurora, plus a soft wider glow tube.
  const TUBE = small ? 220 : 400;
  const railGeo = keep(new THREE.TubeGeometry(curve, TUBE, 0.035, 8, true));
  const ramp = colors.rail.map((c) => new THREE.Color(c));
  const tint = (u: number, out: Three.Color) => {
    const x = wrap(u) * ramp.length, i = Math.floor(x);
    return out.copy(ramp[i % ramp.length]).lerp(ramp[(i + 1) % ramp.length], x - i);
  };
  const rgb = new Float32Array(railGeo.attributes.position.count * 3);
  const tmp = new THREE.Color();
  for (let v = 0; v < railGeo.attributes.position.count; v++) {
    tint(Math.floor(v / 9) / TUBE, tmp).toArray(rgb, v * 3);
  }
  railGeo.setAttribute("color", new THREE.BufferAttribute(rgb, 3));
  scene.add(new THREE.Mesh(railGeo, keep(new THREE.MeshBasicMaterial({ vertexColors: true }))));
  const glowGeo = keep(new THREE.TubeGeometry(curve, TUBE, 0.16, 8, true));
  glowGeo.setAttribute("color", new THREE.BufferAttribute(rgb.slice(0, glowGeo.attributes.position.count * 3), 3));
  scene.add(
    new THREE.Mesh(
      glowGeo,
      keep(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending })),
    ),
  );

  // Sleepers: dots under the rail, the planet's dotted language.
  const SLEEPERS = small ? 90 : 160;
  const dots = new Float32Array(SLEEPERS * 3);
  for (let i = 0; i < SLEEPERS; i++) curve.getPointAt(i / SLEEPERS).add(new THREE.Vector3(0, -0.12, 0)).toArray(dots, i * 3);
  const dotGeo = keep(new THREE.BufferGeometry());
  dotGeo.setAttribute("position", new THREE.BufferAttribute(dots, 3));
  scene.add(new THREE.Points(dotGeo, keep(new THREE.PointsMaterial({ color: colors.muted, size: 0.05, transparent: true, opacity: 0.6 }))));

  // The station: a soft pool of light under the front of the loop.
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 128;
  const gc = glowCanvas.getContext("2d")!;
  const fade = gc.createRadialGradient(64, 64, 0, 64, 64, 64);
  fade.addColorStop(0, colors.glow);
  fade.addColorStop(1, "transparent");
  gc.fillStyle = fade;
  gc.fillRect(0, 0, 128, 128);
  const pool = keep(new THREE.PlaneGeometry(3.4, 3.4));
  const poolMat = keep(
    new THREE.MeshBasicMaterial({ map: keep(new THREE.CanvasTexture(glowCanvas)), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  const station = new THREE.Mesh(pool, poolMat);
  station.rotation.x = -Math.PI / 2;
  station.position.copy(curve.getPointAt(0)).add(new THREE.Vector3(0, -0.5, 0));
  scene.add(station);

  const carGeo = keep(new THREE.PlaneGeometry(1.5, 1.875));
  const meshes = cars.map((car) => {
    const map = keep(carTexture(THREE, car, colors, { rtl, font: opts.font, px: small ? 256 : 512 }));
    const mesh = new THREE.Mesh(carGeo, keep(new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false })));
    scene.add(mesh);
    return mesh;
  });

  let offset = 0, target = 0;
  const place = () => {
    meshes.forEach((m, i) => {
      const u = wrap(i / n - offset);
      const p = curve.getPointAt(u);
      const front = (p.z + rz) / (2 * rz); // 1 at the station side, 0 at the back
      m.position.set(p.x, p.y + 0.95, p.z);
      m.quaternion.copy(camera.quaternion);
      m.scale.setScalar(0.7 + 0.45 * front * front);
      (m.material as Three.MeshBasicMaterial).opacity = 0.45 + 0.55 * front;
      m.renderOrder = Math.round(front * 100);
    });
  };

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    // Keep the whole loop in view on narrow screens.
    const dist = small ? 9.5 : Math.max(10, 13.5 / camera.aspect);
    camera.position.set(0, 2.4, dist);
    camera.lookAt(0, 0.1, 0);
    camera.updateProjectionMatrix();
  };
  resize();

  const ray = new THREE.Raycaster();
  return {
    /** Advances the easing; returns true while still moving. */
    step(dt: number) {
      const d = loopDelta(offset, target);
      offset = Math.abs(d) < 1e-4 ? target : wrap(offset + d * follow(dt));
      place();
      renderer.render(scene, camera);
      return offset !== target;
    },
    /** Jump without easing (reduced motion). */
    jump() {
      offset = target;
      place();
      renderer.render(scene, camera);
    },
    select(i: number) {
      target = wrap(i / n);
    },
    /** Drag by a fraction of the loop; the caller snaps on release. */
    nudge(by: number) {
      offset = wrap(offset + by);
      target = offset;
    },
    nearest: () => Math.round(wrap(offset) * n) % n,
    pick(x: number, y: number): number | null {
      ray.setFromCamera(new THREE.Vector2(x, y), camera);
      const hit = ray.intersectObjects(meshes, false).sort((a, b) => b.object.renderOrder - a.object.renderOrder)[0];
      return hit ? meshes.findIndex((m) => m === hit.object) : null;
    },
    resize,
    dispose() {
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
}
