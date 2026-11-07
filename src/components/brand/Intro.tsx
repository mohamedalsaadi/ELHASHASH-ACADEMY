"use client";

import gsap from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { useEffect, useRef } from "react";
import { MARK_VIEWBOX, RIDGE_HALVES, RIDGE_WIDTH, SUMMIT } from "@/app/brand-svg";

/**
 * The home intro, about 2.6 s, once per tab session. The ridges rise from their feet, the gold point climbs the outer
 * ridge to the peak, then the whole mark shrinks into the header's logo while the hero copy rises.
 *
 * /intro-guard.js decides whether it plays and sets html[data-intro="play"] before paint, so the first frame is already
 * the empty ground. Without that attribute this renders nothing visible and does no work: repeat visits, reduced motion
 * and no-JS all get the finished page. Any input ends it (the guard listens; it sets "skip").
 */
let leaving = 0;

export function Intro({ skipLabel, rtl }: { skipLabel: string; rtl: boolean }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    const root = document.documentElement;
    clearTimeout(leaving);
    // Arriving by in-app navigation the guard script runs after this effect: mark the session so it stands down.
    try {
      sessionStorage.setItem("as-intro", "1");
    } catch {}
    if (!svg || (root.dataset.intro !== "play" && root.dataset.intro !== "run")) return;
    gsap.registerPlugin(MotionPathPlugin);

    const ridges = svg.querySelectorAll<SVGPathElement>("[data-ridge]");
    const dot = svg.querySelector<SVGCircleElement>("[data-dot]")!;
    // The point climbs the start-side half of the outer ridge: right in Arabic, left in English.
    const climb = svg.querySelector<SVGPathElement>(`[data-climb="${rtl ? "end" : "start"}"]`)!;
    const finish = () => {
      if (root.dataset.intro) delete root.dataset.intro;
    };

    gsap.set(ridges, { strokeDasharray: "1 1.1", strokeDashoffset: 1.02 });
    gsap.set(dot, { autoAlpha: 0 });
    root.dataset.intro = "run";

    const tl = gsap.timeline({ onComplete: finish });
    tl.to(ridges, { strokeDashoffset: 0, duration: 0.8, ease: "power2.inOut", stagger: 0.07 }, 0.05)
      .set(dot, { autoAlpha: 1 }, 0.35)
      .to(dot, { duration: 0.8, ease: "power2.inOut", motionPath: { path: climb, align: climb, alignOrigin: [0.5, 0.5] } }, 0.35)
      .to(dot, { x: 0, y: 0, duration: 0.32, ease: "back.out(2.2)" }, 1.15);

    // The landing: measured when it starts, so a header that moved or a resize still lands true.
    const land = () => {
      const header = document.querySelector("[data-header-mark]");
      const to = header?.getBoundingClientRect();
      const from = svg.getBoundingClientRect();
      const ground = svg.parentElement!;
      gsap.to(ground.querySelector("button"), { autoAlpha: 0, duration: 0.2 });
      if (!to || to.width === 0) return gsap.to(ground, { autoAlpha: 0, duration: 0.5, ease: "power2.out" });
      gsap.to(svg, {
        x: to.left + to.width / 2 - (from.left + from.width / 2),
        y: to.top + to.height / 2 - (from.top + from.height / 2),
        scale: to.width / from.width,
        duration: 0.8,
        ease: "expo.inOut",
      });
      gsap.to(ground, { backgroundColor: "transparent", duration: 0.6, ease: "power1.inOut", delay: 0.2 });
    };
    tl.call(land, undefined, 1.75).to({}, { duration: 0.85 });

    // The guard moves to "skip" on any input, and clears the attribute itself.
    const watch = new MutationObserver(() => {
      if (root.dataset.intro !== "run") tl.kill();
    });
    watch.observe(root, { attributes: true, attributeFilter: ["data-intro"] });

    return () => {
      watch.disconnect();
      tl.kill();
      gsap.killTweensOf(svg);
      gsap.killTweensOf(svg.parentElement);
      // Deferred, so React's strict-mode remount can pick the intro back up; a real navigation away still clears it.
      leaving = window.setTimeout(finish, 50);
    };
  }, [rtl]);

  return (
    <>
      {/* Must run before the hero paints, so it is not deferred. Same-origin, so the CSP forbids inline script outright. */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="/intro-guard.js" />
      <div className="as-intro" aria-hidden="true">
        <svg ref={ref} viewBox={MARK_VIEWBOX} fill="none" className="w-[min(58vw,22rem)] overflow-visible" style={{ transformOrigin: "50% 50%" }}>
          <g stroke="currentColor" strokeWidth={RIDGE_WIDTH} strokeLinecap="round">
            {RIDGE_HALVES.map(([start, end], i) => (
              <g key={start}>
                <path data-ridge="" pathLength={1} d={start} data-climb={i === 0 ? "start" : undefined} />
                <path data-ridge="" pathLength={1} d={end} data-climb={i === 0 ? "end" : undefined} />
              </g>
            ))}
          </g>
          <circle data-dot="" {...SUMMIT} className="fill-summit" />
        </svg>
        <button type="button" className="btn btn-outline absolute end-4 top-4 text-small">
          {skipLabel}
        </button>
      </div>
    </>
  );
}
