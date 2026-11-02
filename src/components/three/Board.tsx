"use client";

import { useEffect, useRef } from "react";

/**
 * The home hero board. On the first visit of a tab session (html[data-intro="play"], set by the guard in Intro.tsx)
 * the chalk draws from the start; otherwise, or once skipped, it opens on the finished board. Under reduced motion it
 * draws one still frame with no dust. It pauses when off-screen or the tab is hidden.
 */
export function Board({ rtl, word }: { rtl: boolean; word: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const root = document.documentElement;
      const probe = document.createElement("span");
      probe.className = "font-hand";
      document.body.append(probe);
      const font = getComputedStyle(probe).fontFamily;
      probe.remove();
      const [THREE, { createBoard, BOARD_END }] = await Promise.all([
        import("three"),
        import("./board-scene"),
        document.fonts?.load(`700 48px ${font}`, word).catch(() => undefined),
      ]);
      if (disposed) return;

      const css = getComputedStyle(root);
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const board = createBoard(THREE, canvas, {
        rtl,
        small: innerWidth < 700,
        word,
        wordRtl: /[؀-ۿ]/.test(word),
        font,
        colors: { chalk: [1, 2, 3, 4, 5, 6].map((i) => css.getPropertyValue(`--color-chalk-${i}`).trim()) },
      });

      if (reduce) {
        const still = () => board.render(BOARD_END + 2, 0);
        const onResize = () => (board.resize(), still());
        still();
        addEventListener("resize", onResize);
        cleanup = () => (removeEventListener("resize", onResize), board.dispose());
        return;
      }

      // Draw from the top only when the intro guard asked for it; any input finishes the drawing at once.
      let t0 = performance.now() - (root.dataset.intro === "play" ? 0 : BOARD_END * 1000);
      const skip = () => {
        if ((performance.now() - t0) / 1000 < BOARD_END) t0 = performance.now() - BOARD_END * 1000;
      };
      let px = 0, py = 0;
      const onMove = (e: PointerEvent) => { px = e.clientX / innerWidth - 0.5; py = e.clientY / innerHeight - 0.5; };
      let visible = true, raf = 0;
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
      io.observe(canvas);
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        if (visible && !document.hidden) board.render((now - t0) / 1000, now / 1000, px, py);
      };
      raf = requestAnimationFrame(frame);
      const inputs = ["pointerdown", "keydown", "wheel", "touchmove"];
      addEventListener("resize", board.resize);
      addEventListener("pointermove", onMove, { passive: true });
      inputs.forEach((e) => addEventListener(e, skip, { once: true, passive: true }));
      cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        removeEventListener("resize", board.resize);
        removeEventListener("pointermove", onMove);
        inputs.forEach((e) => removeEventListener(e, skip));
        board.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [rtl, word]);

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 size-full" />;
}
