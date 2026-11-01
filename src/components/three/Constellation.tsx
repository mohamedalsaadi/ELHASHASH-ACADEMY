"use client";

import { useEffect, useRef } from "react";

// Capitals of the countries the site serves, [lat, lon]. Pins light in the order the catalogue lists the countries.
const CAPITALS: Record<string, [number, number]> = {
  EG: [30.04, 31.24],
  AE: [24.45, 54.38],
  SA: [24.71, 46.68],
  KW: [29.38, 47.99],
  QA: [25.29, 51.53],
  BH: [26.23, 50.59],
  OM: [23.59, 58.41],
};
const AURORA = ["--color-aurora-1", "--color-aurora-3", "--color-aurora-4", "--color-aurora-5", "--color-aurora-6"];

// Story beats in seconds: points swirl in and spell A+ (0.1–1.3), hold, wrap into a globe (1.7–2.8), pins light from 2.6.
const END = 3.4;

/**
 * The home hero scene. On the first visit of a tab session (html[data-intro="play"], set by the guard in Intro.tsx)
 * the story plays from the start; otherwise, or once skipped, it opens on the finished globe. Under reduced motion it
 * draws one still frame. It pauses when off-screen or the tab is hidden.
 */
export function Constellation({ codes, rtl }: { codes: string[]; rtl: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      await document.fonts?.ready;
      if (disposed) return;

      const root = document.documentElement;
      const css = getComputedStyle(root);
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const small = innerWidth < 700;
      const side = rtl ? -1 : 1;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      const scene = new THREE.Scene();
      const group = new THREE.Group();
      scene.add(group);

      // The A+ glyphs, sampled from the display face into target points.
      const off = document.createElement("canvas");
      off.width = 400;
      off.height = 200;
      const cx = off.getContext("2d")!;
      cx.fillStyle = "#fff";
      cx.font = `700 180px ${css.getPropertyValue("--font-readex") || "sans-serif"}`;
      cx.textAlign = "center";
      cx.textBaseline = "middle";
      cx.fillText("A+", 200, 108);
      const pixels = cx.getImageData(0, 0, 400, 200).data;
      const text: number[][] = [];
      for (let y = 0; y < 200; y += 2)
        for (let x = 0; x < 400; x += 2)
          if (pixels[(y * 400 + x) * 4 + 3] > 128) text.push([(x - 200) / 70, -(y - 100) / 70, (Math.random() - 0.5) * 0.25]);

      const N = small ? 2200 : 4200;
      const start = new Float32Array(N * 3), word = new Float32Array(N * 3), globe = new Float32Array(N * 3);
      const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
      const stops = AURORA.map((v) => new THREE.Color(css.getPropertyValue(v).trim() || "#ffffff"));
      const c = new THREE.Color();
      for (let i = 0; i < N; i++) {
        const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 5;
        start.set([Math.cos(a) * r, (Math.random() - 0.5) * 6, Math.sin(a) * r - 2], i * 3);
        word.set(text.length ? text[i % text.length] : [0, 0, 0], i * 3);
        // Fibonacci sphere: an even skin of points.
        const y = 1 - (i / (N - 1)) * 2, rr = Math.sqrt(1 - y * y), th = Math.PI * (3 - Math.sqrt(5)) * i;
        globe.set([Math.cos(th) * rr * 1.15, y * 1.15, Math.sin(th) * rr * 1.15], i * 3);
        const t = ((y + 1) / 2) * (stops.length - 1), k = Math.floor(t);
        c.copy(stops[k]).lerp(stops[Math.min(k + 1, stops.length - 1)], t - k);
        col.set([c.r, c.g, c.b], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const pointsMat = new THREE.PointsMaterial({ size: small ? 0.03 : 0.024, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
      group.add(new THREE.Points(geo, pointsMat));

      // Country pins with a pulsing halo, in each country's own colour.
      const spin = new THREE.Group();
      group.add(spin);
      const ll = (lat: number, lon: number, r: number) => {
        const p = ((90 - lat) * Math.PI) / 180, t = ((lon + 180) * Math.PI) / 180;
        return new THREE.Vector3(-r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t));
      };
      const pins = codes
        .filter((code) => CAPITALS[code])
        .map((code) => {
          const color = css.getPropertyValue(`--color-line-${code.toLowerCase()}`).trim() || "#ffffff";
          const dot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 }));
          dot.position.copy(ll(...CAPITALS[code], 1.17));
          const halo = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.075, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide }));
          halo.position.copy(dot.position);
          halo.lookAt(0, 0, 0);
          spin.add(dot, halo);
          return { dot, halo };
        });

      const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
      const ease = (t: number) => 1 - Math.pow(1 - t, 4);
      const inout = (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2);
      const FACE = -2.25; // turns the Gulf toward the camera

      let px = 0, py = 0;
      const draw = (t: number) => {
        const a1 = ease(clamp01((t - 0.1) / 1.2)), a2 = inout(clamp01((t - 1.7) / 1.1));
        const rot = a2 * FACE - (t > 2.8 ? (t - 2.8) * 0.12 : 0);
        const cr = Math.cos(rot), sr = Math.sin(rot), swirl = (1 - a1) * 2.5, ca = Math.cos(swirl), sa = Math.sin(swirl);
        for (let i = 0; i < N * 3; i += 3) {
          const wx = start[i] + (word[i] - start[i]) * a1, wy = start[i + 1] + (word[i + 1] - start[i + 1]) * a1, wz = start[i + 2] + (word[i + 2] - start[i + 2]) * a1;
          const rx = wx * ca - wz * sa, rz = wx * sa + wz * ca;
          const gx = globe[i] * cr - globe[i + 2] * sr, gz = globe[i] * sr + globe[i + 2] * cr;
          pos[i] = rx + (gx - rx) * a2;
          pos[i + 1] = wy + (globe[i + 1] - wy) * a2;
          pos[i + 2] = rz + (gz - rz) * a2;
        }
        geo.attributes.position.needsUpdate = true;
        spin.rotation.y = rot;
        pins.forEach((p, k) => {
          const v = clamp01((t - 2.6 - k * 0.09) / 0.3);
          (p.dot.material as THREE.MeshBasicMaterial).opacity = v;
          (p.halo.material as THREE.MeshBasicMaterial).opacity = v * 0.8;
          p.halo.scale.setScalar(1 + (((t * 0.8 + k * 0.2) % 1) * 1.5) * v);
        });
        group.position.set(small ? 0 : side * 1.45 * a2, small ? 0.7 * a2 : 0.1 * a2, 0);
        camera.position.set(px * 0.5, -py * 0.35, 6 - a2 * 0.6);
        camera.lookAt(group.position.x * 0.3, 0, 0);
        renderer.render(scene, camera);
      };

      const resize = () => {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / Math.max(h, 1);
        camera.updateProjectionMatrix();
      };
      resize();

      if (reduce) {
        draw(END + 2);
        const onResize = () => { resize(); draw(END + 2); };
        addEventListener("resize", onResize);
        cleanup = () => { removeEventListener("resize", onResize); renderer.dispose(); geo.dispose(); pointsMat.dispose(); };
        return;
      }

      // Play from the top only when the intro guard asked for it; any input skips to the globe.
      let t0 = performance.now() - (root.dataset.intro === "play" ? 0 : END * 1000);
      const skip = () => {
        const t = (performance.now() - t0) / 1000;
        if (t < END) t0 = performance.now() - END * 1000;
      };
      const onMove = (e: PointerEvent) => { px = e.clientX / innerWidth - 0.5; py = e.clientY / innerHeight - 0.5; };
      let visible = true, raf = 0;
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
      io.observe(canvas);
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        if (visible && !document.hidden) draw((now - t0) / 1000);
      };
      raf = requestAnimationFrame(frame);
      addEventListener("resize", resize);
      addEventListener("pointermove", onMove, { passive: true });
      ["pointerdown", "keydown", "wheel", "touchmove"].forEach((e) => addEventListener(e, skip, { once: true, passive: true }));
      cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        removeEventListener("resize", resize);
        removeEventListener("pointermove", onMove);
        ["pointerdown", "keydown", "wheel", "touchmove"].forEach((e) => removeEventListener(e, skip));
        renderer.dispose();
        geo.dispose();
        pointsMat.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [codes, rtl]);

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 size-full" />;
}
