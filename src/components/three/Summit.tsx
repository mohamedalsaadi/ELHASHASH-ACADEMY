"use client";

import { useEffect, useRef } from "react";

/**
 * The home hero summit. On the first visit of a tab session (html[data-intro="play"], set by the guard in Intro.tsx)
 * the contour lines rise and the trail climbs from the start; otherwise, or once skipped, it opens on the summit
 * already reached. Under reduced motion it draws one still frame. It pauses when off-screen or the tab is hidden.
 */
export function Summit({ rtl }: { rtl: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const root = document.documentElement;
      // Option B is under review: ?intro=dawn shows it, anything else the Contour scene.
      const dawn = new URLSearchParams(location.search).get("intro") === "dawn";
      const [THREE, { createSummit, SUMMIT_END }, { createDawn }] = await Promise.all([
        import("three"),
        import("./summit-scene"),
        dawn ? import("./dawn-scene") : { createDawn: null },
      ]);
      if (disposed) return;

      const css = getComputedStyle(root);
      const token = (name: string) => css.getPropertyValue(`--color-${name}`).trim();
      const colors = {
        ramp: [1, 2, 3, 4, 6].map((i) => token(`contour-${i}`)),
        summit: token("summit"),
        snow: token("contour-6"),
        night: token("night"),
      };
      const opts = { rtl, small: innerWidth < 700, colors };
      const summit = createDawn ? createDawn(THREE, canvas, opts) : createSummit(THREE, canvas, opts);

      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const still = () => summit.render(SUMMIT_END + 1);
        const onResize = () => (summit.resize(), still());
        still();
        addEventListener("resize", onResize);
        cleanup = () => (removeEventListener("resize", onResize), summit.dispose());
        return;
      }

      // Climb from the foot only when the intro guard asked for it, timed from page load like the guard and the copy;
      // any input reaches the summit at once.
      let t0 = root.dataset.intro === "play" ? 0 : performance.now() - SUMMIT_END * 1000;
      const skip = () => {
        if ((performance.now() - t0) / 1000 < SUMMIT_END) t0 = performance.now() - SUMMIT_END * 1000;
      };
      let px = 0, py = 0, sx = 0, sy = 0;
      const onMove = (e: PointerEvent) => { px = e.clientX / innerWidth - 0.5; py = e.clientY / innerHeight - 0.5; };
      let visible = true, raf = 0;
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
      io.observe(canvas);
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        if (!visible || document.hidden) return;
        sx += (px - sx) * 0.05;
        sy += (py - sy) * 0.05;
        summit.render((now - t0) / 1000, now / 1000, sx, sy);
      };
      raf = requestAnimationFrame(frame);
      const inputs = ["pointerdown", "keydown", "wheel", "touchmove"];
      addEventListener("resize", summit.resize);
      addEventListener("pointermove", onMove, { passive: true });
      inputs.forEach((e) => addEventListener(e, skip, { once: true, passive: true }));
      cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        removeEventListener("resize", summit.resize);
        removeEventListener("pointermove", onMove);
        inputs.forEach((e) => removeEventListener(e, skip));
        summit.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [rtl]);

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 size-full" />;
}
