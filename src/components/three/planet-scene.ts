import type * as Three from "three";
import { LAND } from "./land";

// Capitals of the countries the site serves, [lat, lon].
export const CAPITALS: Record<string, [number, number]> = {
  EG: [30.04, 31.24],
  AE: [24.45, 54.38],
  SA: [24.71, 46.68],
  KW: [29.38, 47.99],
  QA: [25.29, 51.53],
  BH: [26.23, 50.59],
  OM: [23.59, 58.41],
};

export type PlanetColors = {
  deep: string; // night side of the ocean
  ocean: string; // day side of the ocean
  land: string; // land dots, day side
  landAlt: string; // second land tone, mixed by latitude
  warm: string; // Egypt and the Gulf
  warmAlt: string;
  atmosphere: string;
  arcFrom: string;
  arcTo: string;
  pins: Record<string, string>; // country code → colour
};

/** Length of the intro story, seconds. The hero copy rises at 3.2 s (brand.css). */
export const PLANET_END = 4.2;

const D = Math.PI / 180;
const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const smooth = (t: number) => t * t * (3 - 2 * t);
const outCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const inOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2);
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

/**
 * The home planet: dotted continents on a dark ocean, an atmosphere, capitals as beacons joined by arcs of light.
 * Framework-free so the design preview and the site run the same code. `render(t, now)` draws story time `t`
 * (anything past PLANET_END is the settled planet) with `now` driving the idle life (arcs, twinkle, sway).
 */
export function createPlanet(
  THREE: typeof Three,
  canvas: HTMLCanvasElement,
  opts: { codes: string[]; side: 1 | -1; small: boolean; colors: PlanetColors },
) {
  const { codes, side, small, colors } = opts;
  const col = (c: string) => new THREE.Color(c);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  const pr = Math.min(devicePixelRatio, small ? 1.5 : 2);
  renderer.setPixelRatio(pr);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
  const scene = new THREE.Scene();
  const tilt = new THREE.Group();
  const spin = new THREE.Group();
  tilt.add(spin);
  scene.add(tilt);

  const ll = (lat: number, lon: number, r = 1) => {
    const p = (90 - lat) * D, t = (lon + 180) * D;
    return new THREE.Vector3(-r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t));
  };

  // Turn the globe so the Gulf faces the camera, tilted so the region sits a little above centre.
  const focus = ll(25, 45);
  const FACE = Math.atan2(-focus.x, focus.z);
  const TILT = 25 * D * 0.8;

  const sun = { value: new THREE.Vector3(0, 0.25, -1).normalize() };
  const time = { value: 0 };
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  // Ocean: a dark sphere, lit on the sun side, with a violet rim. It writes depth, so the far side's dots hide.
  const ocean = new THREE.Mesh(
    keep(new THREE.SphereGeometry(1, 96, 96)),
    keep(
      new THREE.ShaderMaterial({
        uniforms: { uSun: sun, uDeep: { value: col(colors.deep) }, uOcean: { value: col(colors.ocean) }, uRim: { value: col(colors.atmosphere) } },
        vertexShader: `
          varying vec3 vN; varying vec3 vV;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vN = normalize(mat3(modelMatrix) * normal);
            vV = normalize(cameraPosition - w.xyz);
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader: `
          uniform vec3 uSun, uDeep, uOcean, uRim; varying vec3 vN; varying vec3 vV;
          void main() {
            float l = dot(vN, uSun);
            vec3 c = mix(uDeep, uOcean, smoothstep(-0.25, 1.0, l));
            float fr = pow(1.0 - max(dot(vN, vV), 0.0), 2.5);
            c += uRim * fr * (0.35 + 0.65 * smoothstep(-0.35, 0.6, l));
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    ),
  );
  spin.add(ocean);

  // Land: one dot per sample of the Natural Earth mask. aRegion marks Egypt and the GCC, in their real borders.
  const bytes = Uint8Array.from(atob(LAND.bits), (c) => c.charCodeAt(0));
  const ours = Uint8Array.from(atob(LAND.region), (c) => c.charCodeAt(0));
  const pos: number[] = [], region: number[] = [], rand: number[] = [];
  for (let r = 0, i = 0; r < LAND.rows; r++) {
    const lat = LAND.lat0 + r * LAND.step;
    const n = Math.max(1, Math.round(LAND.cols * Math.cos(lat * D)));
    for (let j = 0; j < n; j++, i++) {
      if (!((bytes[i >> 3] >> (i & 7)) & 1)) continue;
      const lon = -180 + (j + 0.5) * (360 / n);
      const v = ll(lat, lon, 1.003);
      pos.push(v.x, v.y, v.z);
      region.push((ours[i >> 3] >> (i & 7)) & 1);
      rand.push(Math.random());
    }
  }
  const landGeo = keep(new THREE.BufferGeometry());
  landGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  landGeo.setAttribute("aRegion", new THREE.Float32BufferAttribute(region, 1));
  landGeo.setAttribute("aRand", new THREE.Float32BufferAttribute(rand, 1));
  const scale = { value: 1 };
  const regionOn = { value: 0 };
  const landMat = keep(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uSun: sun, uTime: time, uScale: scale, uRegion: regionOn, uSize: { value: small ? 0.011 : 0.0095 },
        uLand: { value: col(colors.land) }, uLandAlt: { value: col(colors.landAlt) },
        uWarm: { value: col(colors.warm) }, uWarmAlt: { value: col(colors.warmAlt) },
      },
      vertexShader: `
        attribute float aRegion; attribute float aRand;
        uniform vec3 uSun, uLand, uLandAlt, uWarm, uWarmAlt; uniform float uTime, uScale, uSize, uRegion;
        varying vec3 vC; varying float vA;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vec3 n = normalize(w.xyz - (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz);
          float day = smoothstep(-0.2, 0.45, dot(n, uSun));
          float face = dot(n, normalize(cameraPosition - w.xyz));
          vec3 land = mix(uLand, uLandAlt, smoothstep(-0.2, 0.9, position.y + aRand * 0.25));
          vec3 c = mix(land * 0.12, land, day);
          // Egypt and the Gulf: warm by day, city-light glow by night, a slow twinkle.
          float tw = 0.75 + 0.25 * sin(uTime * 2.0 + aRand * 40.0);
          vec3 warm = mix(uWarm, uWarmAlt, aRand);
          c = mix(c, mix(warm * 0.85 * tw, warm, day), aRegion * uRegion);
          vC = c;
          vA = smoothstep(0.0, 0.3, face) * (0.55 + 0.45 * day + 0.4 * aRegion * uRegion);
          vec4 mv = viewMatrix * w;
          gl_PointSize = uSize * (1.0 + 0.6 * aRegion * uRegion) * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vC; varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          gl_FragColor = vec4(vC, vA * smoothstep(0.5, 0.25, d));
        }`,
    }),
  );
  const land = new THREE.Points(landGeo, landMat);
  land.renderOrder = 1;
  spin.add(land);

  // Atmosphere: a back-faced shell glowing at the limb; it blazes when the sun is behind the planet (the dawn crescent).
  const atmoMat = keep(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uSun: sun, uColor: { value: col(colors.atmosphere) } },
      vertexShader: `
        varying vec3 vNv; varying vec3 vN; varying vec3 vV;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vNv = normalize(normalMatrix * normal);
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: `
        uniform vec3 uSun, uColor; varying vec3 vNv; varying vec3 vN; varying vec3 vV;
        void main() {
          float glow = 0.7 * pow(max(0.62 - dot(vNv, vec3(0.0, 0.0, 1.0)), 0.0), 5.0);
          float lit = 0.18 + 0.82 * smoothstep(-0.5, 0.6, dot(-vN, uSun));
          float scatter = pow(max(dot(-vV, uSun), 0.0), 5.0);
          vec3 col = uColor * glow * (lit + 3.5 * scatter);
          // Alpha follows brightness so the shell never paints the page dark: (col / a) * a adds exactly col.
          float a = clamp(max(max(col.r, col.g), col.b), 0.0, 1.0);
          gl_FragColor = vec4(col / max(a, 0.001), a);
        }`,
    }),
  );
  const atmo = new THREE.Mesh(keep(new THREE.SphereGeometry(1.1, 64, 64)), atmoMat);
  spin.add(atmo);

  // Stars: a far shell, faint and twinkling.
  const starPos: number[] = [], starRand: number[] = [];
  for (let i = 0; i < (small ? 700 : 1600); i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 40);
    starPos.push(v.x, v.y, v.z);
    starRand.push(Math.random());
  }
  const starGeo = keep(new THREE.BufferGeometry());
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
  starGeo.setAttribute("aRand", new THREE.Float32BufferAttribute(starRand, 1));
  const starsOn = { value: 0 };
  const starMat = keep(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: time, uOn: starsOn, uPR: { value: pr } },
      vertexShader: `
        attribute float aRand; uniform float uTime, uPR; varying float vA;
        void main() {
          vA = (0.25 + 0.75 * aRand) * (0.6 + 0.4 * sin(uTime * (0.6 + aRand * 1.8) + aRand * 30.0));
          gl_PointSize = (0.8 + aRand * 1.6) * uPR;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform float uOn; varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          gl_FragColor = vec4(vec3(0.85, 0.85, 1.0), vA * uOn * smoothstep(0.5, 0.1, d));
        }`,
    }),
  );
  scene.add(new THREE.Points(starGeo, starMat));

  // Beacons: a beam of light rising from each capital, a core and a ring that ripples outward.
  const present = codes.filter((c) => CAPITALS[c]);
  const beamGeo = keep(new THREE.CylinderGeometry(0.0032, 0.0032, 1, 8, 1, true).translate(0, 0.5, 0));
  const coreGeo = keep(new THREE.SphereGeometry(0.012, 12, 12));
  const ringGeo = keep(new THREE.RingGeometry(0.02, 0.026, 40));
  const up = new THREE.Vector3(0, 1, 0);
  const beacons = present.map((code) => {
    // Country colours lifted toward white: the darker ones (Qatar's maroon) would not glow on the night side.
    const c = col(colors.pins[code] ?? colors.warm).lerp(new THREE.Color(1, 1, 1), 0.35);
    const at = ll(...CAPITALS[code], 1.004);
    const n = at.clone().normalize();
    const grow = { value: 0 };
    const beamMat = keep(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: c }, uGrow: grow },
        vertexShader: `varying float vY; void main() { vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 uColor; uniform float uGrow; varying float vY;
          void main() { gl_FragColor = vec4(uColor * 1.6, pow(1.0 - vY, 1.6) * uGrow); }`,
      }),
    );
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.copy(at);
    beam.quaternion.setFromUnitVectors(up, n);
    const coreMat = keep(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0 }));
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.copy(at);
    const ringMat = keep(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(at);
    ring.lookAt(at.clone().multiplyScalar(2));
    spin.add(beam, core, ring);
    return { beam, grow, coreMat, ring, ringMat };
  });

  // Arcs: Cairo and Abu Dhabi are the hubs; every other capital links to the nearer one. Light draws along each arc,
  // then a pulse keeps travelling it.
  const hubs = ["EG", "AE"].filter((h) => present.includes(h));
  const pairs: [string, string][] = [];
  if (hubs.length === 2) pairs.push(["EG", "AE"]);
  for (const code of present) {
    if (hubs.includes(code) || !hubs.length) continue;
    const near = hubs.reduce((a, b) => (ll(...CAPITALS[code]).distanceTo(ll(...CAPITALS[a])) <= ll(...CAPITALS[code]).distanceTo(ll(...CAPITALS[b])) ? a : b));
    pairs.push([near, code]);
  }
  const arcs = pairs.map(([a, b], k) => {
    const va = ll(...CAPITALS[a]).normalize(), vb = ll(...CAPITALS[b]).normalize();
    const angle = va.angleTo(vb);
    const lift = 0.08 + angle * 0.9;
    const pts = Array.from({ length: 48 }, (_, i) => {
      const s = i / 47;
      return new THREE.Vector3().copy(va).lerp(vb, s).normalize().multiplyScalar(1.004 + lift * Math.sin(Math.PI * s));
    });
    const draw = { value: 0 };
    const mat = keep(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uDraw: draw, uTime: time, uOffset: { value: k * 0.23 }, uFrom: { value: col(colors.arcFrom) }, uTo: { value: col(colors.arcTo) } },
        vertexShader: `varying float vU; void main() { vU = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float uDraw, uTime, uOffset; uniform vec3 uFrom, uTo; varying float vU;
          void main() {
            float drawn = step(vU, uDraw);
            float head = exp(-pow((vU - uDraw) * 28.0, 2.0)) * (1.0 - step(1.0, uDraw));
            float p = fract(uTime * 0.32 + uOffset);
            float pulse = exp(-pow((vU - p) * 10.0, 2.0)) * step(1.0, uDraw);
            vec3 c = mix(uFrom, uTo, vU);
            gl_FragColor = vec4(c * (1.0 + 1.5 * (head + pulse)), drawn * (0.35 + 0.65 * pulse) + head);
          }`,
      }),
    );
    const tube = new THREE.Mesh(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.0026, 6)), mat);
    spin.add(tube);
    return draw;
  });

  // Framing: on wide screens the planet sits beside the copy (inline-end); on phones it rises above it.
  // On wide screens the distance grows as the hero gets narrower and the planet sits 62% of the way to the edge,
  // so it never crowds the copy whatever the window shape.
  const final = { x: 0, y: small ? 0.95 : 0.02, dist: small ? 6.4 : 4.6 };
  // Light from the copy's side and a little behind, so a night side with the region's city glow stays in view.
  const sunFinal = new THREE.Vector3(-side * 0.9, 0.35, 0.3).normalize();
  // Behind and above the planet at the start: a crescent of dawn on the upper rim.
  const sunBack = new THREE.Vector3(side * 0.55, 0.6, -0.6).normalize();

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    const half = Math.tan((camera.fov * D) / 2);
    scale.value = (h * pr) / (2 * half);
    if (!small) {
      final.dist = 4.6 * Math.max(1, 1.75 / camera.aspect);
      final.x = side * 0.62 * final.dist * half * camera.aspect;
    }
  };
  resize();

  const render = (t: number, now: number, px = 0, py = 0) => {
    time.value = now;
    starsOn.value = smooth(span(t, 0, 1.2));
    const dolly = inOut(span(t, 0.15, 3.1));
    const settle = smooth(span(t, PLANET_END - 0.6, PLANET_END + 1.2)); // idle life fades in after the story
    sun.value.copy(sunBack).lerp(sunFinal, inOut(span(t, 0.5, 2.9))).normalize();
    regionOn.value = smooth(span(t, 2.1, 3.1));

    tilt.position.set(final.x * dolly, final.y * dolly, 0);
    // The planet sits off-axis, so the camera sees it from the side; turning by that angle keeps the Gulf facing us.
    const offAxis = Math.atan2(-tilt.position.x, final.dist);
    spin.rotation.y = FACE + offAxis + (1 - outCubic(span(t, 0.2, 3.1))) * 2.4 + Math.sin(now * 0.12) * 0.08 * settle + px * 0.12;
    tilt.rotation.x = TILT + py * 0.1;

    beacons.forEach((b, i) => {
      const v = smooth(span(t, 2.55 + i * 0.09, 3.05 + i * 0.09));
      b.grow.value = v;
      b.beam.scale.set(1, 0.03 + 0.11 * v + 0.03 * v * Math.sin(now * 1.7 + i), 1);
      b.coreMat.opacity = v;
      const r = (now * 0.55 + i * 0.17) % 1;
      b.ring.scale.setScalar(1 + r * 2.2);
      b.ringMat.opacity = v * (1 - r) * 0.85;
    });
    arcs.forEach((draw, i) => (draw.value = inOut(span(t, 2.9 + i * 0.13, 3.75 + i * 0.13))));

    camera.position.set(px * 0.18, -py * 0.12, 11 + (final.dist - 11) * dolly);
    camera.lookAt(tilt.position.x * 0.12, tilt.position.y * 0.12, 0);
    renderer.render(scene, camera);
  };

  return {
    render,
    resize,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
}
