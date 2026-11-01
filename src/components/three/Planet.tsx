"use client";

import { useEffect, useRef } from "react";

/**
 * The home hero planet. On the first visit of a tab session (html[data-intro="play"], set by the guard in Intro.tsx)
 * the dawn story plays from the start; otherwise, or once skipped, it opens on the settled planet. Under reduced
 * motion it draws one still frame. It pauses when off-screen or the tab is hidden.
 */
export function Planet({ codes, rtl }: { codes: string[]; rtl: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const [THREE, { createPlanet, PLANET_END }] = await Promise.all([import("three"), import("./planet-scene")]);
      if (disposed) return;

      const root = document.documentElement;
      const css = getComputedStyle(root);
      const token = (name: string) => css.getPropertyValue(`--color-${name}`).trim();
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const planet = createPlanet(THREE, canvas, {
        codes,
        side: rtl ? -1 : 1,
        small: innerWidth < 700,
        colors: {
          deep: token("planet-deep"),
          ocean: token("planet-ocean"),
          land: token("planet-land"),
          landAlt: token("aurora-3"),
          warm: token("aurora-1"),
          warmAlt: token("aurora-2"),
          atmosphere: token("planet-atmosphere"),
          arcFrom: token("aurora-1"),
          arcTo: token("aurora-3"),
          pins: Object.fromEntries(codes.map((c) => [c, token(`line-${c.toLowerCase()}`)])),
        },
      });

      if (reduce) {
        const still = () => planet.render(PLANET_END + 2, 0);
        const onResize = () => (planet.resize(), still());
        still();
        addEventListener("resize", onResize);
        cleanup = () => (removeEventListener("resize", onResize), planet.dispose());
        return;
      }

      // Play from the top only when the intro guard asked for it; any input skips to the settled planet.
      let t0 = performance.now() - (root.dataset.intro === "play" ? 0 : PLANET_END * 1000);
      const skip = () => {
        if ((performance.now() - t0) / 1000 < PLANET_END) t0 = performance.now() - PLANET_END * 1000;
      };
      let px = 0, py = 0;
      const onMove = (e: PointerEvent) => { px = e.clientX / innerWidth - 0.5; py = e.clientY / innerHeight - 0.5; };
      let visible = true, raf = 0;
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
      io.observe(canvas);
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        if (visible && !document.hidden) planet.render((now - t0) / 1000, now / 1000, px, py);
      };
      raf = requestAnimationFrame(frame);
      const inputs = ["pointerdown", "keydown", "wheel", "touchmove"];
      addEventListener("resize", planet.resize);
      addEventListener("pointermove", onMove, { passive: true });
      inputs.forEach((e) => addEventListener(e, skip, { once: true, passive: true }));
      cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        removeEventListener("resize", planet.resize);
        removeEventListener("pointermove", onMove);
        inputs.forEach((e) => removeEventListener(e, skip));
        planet.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [codes, rtl]);

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 size-full" />;
}
