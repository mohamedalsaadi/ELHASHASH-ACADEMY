"use client";

import { useEffect, useRef } from "react";
import { RIDGE_WIDTH, SUMMIT } from "@/app/brand-svg";
import { createHop, HALVES, HOP_VIEWBOX, SUMMIT_END } from "./hop-scene";

/**
 * The home hero intro (DESIGN.md §6): the flat brand mark, whose gold point hops onto its peak. On the first visit of
 * a tab session (html[data-intro="play"], set by the guard in Intro.tsx) it plays from the start; otherwise, or once
 * skipped, it shows the finished mark. Under reduced motion it draws one still frame. It pauses when off-screen or the
 * tab is hidden. Without JS the finished mark is already in the HTML.
 */
export function Summit({ rtl }: { rtl: boolean }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const root = document.documentElement;
    const hop = createHop(svg, rtl);

    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      hop.render(SUMMIT_END + 1);
      return;
    }

    // Play from the top only when the intro guard asked for it, timed from page load like the guard and the copy;
    // any input jumps to the finished mark.
    let t0 = root.dataset.intro === "play" ? 0 : performance.now() - SUMMIT_END * 1000;
    const skip = () => {
      if ((performance.now() - t0) / 1000 < SUMMIT_END) t0 = performance.now() - SUMMIT_END * 1000;
    };
    let visible = true, raf = 0;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(svg);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      hop.render((now - t0) / 1000, now / 1000);
    };
    raf = requestAnimationFrame(frame);
    const inputs = ["pointerdown", "keydown", "wheel", "touchmove"];
    inputs.forEach((e) => addEventListener(e, skip, { once: true, passive: true }));
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      inputs.forEach((e) => removeEventListener(e, skip));
    };
  }, [rtl]);

  // Below lg the mark sits in the band above the copy; from lg on the end side, vertically centred.
  return (
    <svg
      ref={ref}
      viewBox={HOP_VIEWBOX}
      aria-hidden="true"
      fill="none"
      className="absolute inset-x-0 top-[6vw] mx-auto w-[min(84vw,24rem)] overflow-visible text-contour-6 lg:inset-x-auto lg:end-[4%] lg:top-1/2 lg:mx-0 lg:w-[min(46vw,40rem)] lg:-translate-y-1/2"
    >
      <g stroke="currentColor" strokeWidth={RIDGE_WIDTH} strokeLinecap="round">
        {HALVES.map((d) => (
          <path key={d} data-ridge="" d={d} pathLength={1} strokeDasharray="1 1" />
        ))}
      </g>
      <circle data-ring="" cx={SUMMIT.cx} cy={SUMMIT.cy} r={SUMMIT.r} className="stroke-summit" strokeWidth={0.6} opacity={0} />
      <ellipse data-dot="" cx={SUMMIT.cx} cy={SUMMIT.cy} rx={SUMMIT.r} ry={SUMMIT.r} className="fill-summit" />
    </svg>
  );
}
