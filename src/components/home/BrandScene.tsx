"use client";

import { useEffect, useRef, type RefObject } from "react";
import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  TorusGeometry,
  WebGLRenderer,
} from "three";

// Same curve as --ease-out, solved numerically for x → y.
function ease(t: number) {
  let a = 0;
  let b = 1;
  for (let i = 0; i < 20; i++) {
    const m = (a + b) / 2;
    const x = 3 * m * (1 - m) * (1 - m) * 0.2 + 3 * m * m * (1 - m) * 0.2 + m * m * m;
    if (x < t) a = m;
    else b = m;
  }
  const s = (a + b) / 2;
  return 3 * s * (1 - s) * (1 - s) * 0.7 + 3 * s * s * (1 - s) + s * s * s;
}
const span = (p: number, from: number, len: number) => ease(Math.min(1, Math.max(0, (p - from) / len)));

type Props = { progress: RefObject<number>; redraw: RefObject<() => void>; rtl: boolean };

/**
 * The one WebGL brand scene: the mark as a torus over an amber horizon, flat unlit materials in the
 * theme's ink and amber. Plain three (named imports, tree-shaken) keeps the lazy chunk small.
 * It renders only when scroll calls redraw(), never in an idle loop.
 */
export default function BrandScene({ progress, redraw, rtl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const css = getComputedStyle(document.documentElement);
    const ink = new MeshBasicMaterial({ color: css.getPropertyValue("--color-ink").trim() });
    const amber = new MeshBasicMaterial({ color: css.getPropertyValue("--color-amber").trim() });

    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const scene = new Scene();
    const camera = new PerspectiveCamera(35, 1, 0.1, 100);
    const ring = new Mesh(new TorusGeometry(1, 0.045, 24, 160), ink);
    const line = new Mesh(new BoxGeometry(1, 0.045, 0.045), amber);
    const dot = new Mesh(new SphereGeometry(0.09, 24, 16), amber);
    line.position.y = -1;
    dot.position.y = -1;
    scene.add(ring, line, dot);

    const side = rtl ? 1 : -1; // the horizon grows from the inline start
    const draw = () => {
      const p = progress.current ?? 1;
      const a = span(p, 0, 0.35);
      const b = span(p, 0.2, 0.35);
      const s = span(p, 0.6, 0.4);
      line.scale.x = Math.max(0.001, a * 4.2);
      line.position.x = side * 2.1 * (1 - a);
      ring.position.y = 1.4 * (1 - b);
      ring.rotation.x = 0.9 * (1 - b);
      ring.rotation.y = -0.25 * s * side;
      dot.visible = b > 0.999;
      camera.position.set(Math.sin(s * 0.5) * 1.2 * side, 0.2 + 0.4 * s, 7 - 1.2 * s);
      camera.lookAt(0, -0.3, 0);
      renderer.render(scene, camera);
    };
    let frame = 0;
    const request = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    };
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = canvas;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      request();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    redraw.current = request;

    return () => {
      redraw.current = () => {};
      observer.disconnect();
      cancelAnimationFrame(frame);
      scene.traverse((o) => (o instanceof Mesh ? o.geometry.dispose() : undefined));
      ink.dispose();
      amber.dispose();
      renderer.dispose();
    };
  }, [progress, redraw, rtl]);

  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 size-full" />;
}
