"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Two lapis books fall, pages fluttering, and land face down as the A A of the wordmark; then the gold ribbon
// threads through both. Time is read from the guard's start mark, so a late chunk joins the CSS timeline in step.
const END = 1.9;
const W = 1.8, D = 1.25, T = 0.055, PAGES = 8;
const TH = THREE.MathUtils.degToRad(71), TH0 = THREE.MathUtils.degToRad(12);
const H = W * Math.sin(TH);

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const outCubic = (t: number) => 1 - (1 - t) ** 3;
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export default function IntroScene() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // No WebGL: the CSS wordmark carries the intro alone.
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);

    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(-3, 7, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -2, near: 1, far: 20 });
    const rim = new THREE.DirectionalLight(0xf2b544, 2.2);
    rim.position.set(3, 3, -5);
    scene.add(key, rim, new THREE.AmbientLight(0x8890ff, 0.35));

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.38 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const lapis = new THREE.MeshStandardMaterial({ color: 0x2430d8, roughness: 0.42, metalness: 0.05 });
    const paper = new THREE.MeshStandardMaterial({ color: 0xf6f7fb, roughness: 0.85 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xf2b544, metalness: 0.55, roughness: 0.3, emissive: 0xc98a1a, emissiveIntensity: 0.55 });

    // A book: spine at the group origin, covers hinged on it. The open angle is measured below horizontal.
    const coverGeo = new THREE.BoxGeometry(W, T, D).translate(W / 2, 0, 0);
    const pageGeo = new THREE.BoxGeometry(W * 0.965, 0.008, D * 0.93).translate((W * 0.965) / 2, 0, 0);
    const spineGeo = new THREE.CylinderGeometry(T * 0.95, T * 0.95, D, 20).rotateX(Math.PI / 2);
    const books = ([[-0.62, 0, -1], [0.62, 0.14, 1]] as const).map(([x, delay, side]) => {
      const g = new THREE.Group();
      const right = new THREE.Mesh(coverGeo, [lapis, lapis, lapis, paper, lapis, lapis]);
      const left = new THREE.Mesh(coverGeo, [lapis, lapis, paper, lapis, lapis, lapis]);
      const pages = Array.from({ length: PAGES }, () => new THREE.Mesh(pageGeo, paper));
      [right, left, new THREE.Mesh(spineGeo, lapis), ...pages].forEach((m) => {
        m.castShadow = true;
        g.add(m);
      });
      scene.add(g);
      return { g, right, left, pages, x, delay, side };
    });

    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(1, 0.09, 0.09).translate(0.5, 0, 0), gold);
    ribbon.position.set(-1.07, H * 0.365, D / 2 + 0.06);
    scene.add(ribbon);

    function frame(t: number) {
      for (const b of books) {
        const p = clamp((t - b.delay) / 0.85), e = outCubic(p);
        b.g.position.set(lerp(b.x + b.side * 2.4, b.x, e), lerp(H + 4.4, H, e), lerp(-1.2, 0, e));
        b.g.rotation.set(lerp(-0.8, 0, e), lerp(b.side * 2.2, 0, e), lerp(b.side * 0.5, 0, e));
        const close = inOut(clamp((p - 0.2) / 0.8));
        const ang = lerp(TH0, TH, close);
        b.right.rotation.z = -ang;
        b.left.rotation.z = Math.PI + ang;
        b.pages.forEach((pg, i) => {
          const start = -(TH0 + ((Math.PI - 2 * TH0) * (i + 0.5)) / PAGES);
          const end = i < PAGES / 2 ? -(TH + 0.024 * (i + 1)) : -(Math.PI - TH - 0.024 * (PAGES - i));
          pg.rotation.z = lerp(start, end, close) + Math.sin(t * 17 + i * 1.9) * 0.22 * (1 - close);
        });
      }
      ribbon.scale.x = Math.max(0.001, 2.14 * outCubic(clamp((t - 0.95) / 0.38)));
      camera.position.set(0, 1.35, lerp(11.5, 9.4, outCubic(clamp(t / 1.7))));
      camera.lookAt(0, 0.95, 0);
      renderer.render(scene, camera);
    }

    function size() {
      const w = el!.clientWidth, h = el!.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w / h < 1 ? 40 : 24;
      camera.updateProjectionMatrix();
    }
    size();
    addEventListener("resize", size);

    // The scene is alive: start the clock now, so the fall of the books is never missed because this chunk was slow.
    const root = document.documentElement;
    const clock = window as { __asIntroT0?: number };
    if (root.dataset.intro === "ready") {
      clock.__asIntroT0 = performance.now();
      root.dataset.intro = "play";
    }
    const t0 = clock.__asIntroT0 ?? performance.now();
    // Same multiplier the CSS timeline uses; the scene's authored seconds stay unchanged.
    const k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--intro-k")) || 1;
    let raf = 0;
    const tick = () => {
      const t = (performance.now() - t0) / 1000 / k;
      frame(Math.min(t, END));
      if (t < END) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", size);
      [coverGeo, pageGeo, spineGeo, ribbon.geometry, ground.geometry].forEach((g) => g.dispose());
      [lapis, paper, gold].forEach((m) => m.dispose());
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} aria-hidden="true" className="as-intro-scene [&>canvas]:block [&>canvas]:size-full" />;
}
