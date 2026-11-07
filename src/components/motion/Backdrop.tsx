"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

// The brand's own picture, kept quiet: ridgelines like the logo's, a gold point like the summit, and two soft lights.
// Everything is complete at rest. Motion is transform and opacity only, slower than a breath, and it stops under
// reduced motion. The layer sits behind the page and never takes a click.

const W = 1600;
const H = 400;

/** A ridge made of a few sine waves, rounded so the server and the browser print the same path. */
function ridge(seed: number, amp: number, base: number, lift: number) {
  const pts: string[] = [];
  for (let i = 0; i <= 64; i++) {
    const x = (i / 64) * W;
    const n = 0.55 * Math.sin(x * 0.0042 + seed) + 0.3 * Math.sin(x * 0.0091 + seed * 2.1) + 0.15 * Math.sin(x * 0.0173 + seed * 0.7);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)} ${(base - lift - amp * n).toFixed(1)}`);
  }
  return pts.join("");
}

// Far, middle and near ridge. Each is drawn three times, a little apart, like contour lines on a map.
const LAYERS = [
  { seed: 1.3, amp: 70, base: 170, opacity: 0.3, x: 36, y: 6, dur: 26, depth: 0.04 },
  { seed: 3.9, amp: 95, base: 250, opacity: 0.42, x: -48, y: 9, dur: 21, depth: 0.09 },
  { seed: 6.2, amp: 120, base: 340, opacity: 0.55, x: 60, y: 12, dur: 17, depth: 0.16 },
].map((l) => ({ ...l, paths: [0, 16, 32].map((lift) => ridge(l.seed, l.amp, l.base, -lift)) }));

export function Backdrop() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(root.current, { autoAlpha: 0, duration: 1.6, ease: "power2.out" });

        LAYERS.forEach((l, i) => {
          // Two nested elements: one drifts on its own clock, the other follows the scroll, so the tweens never fight.
          gsap.to(`[data-drift="${i}"]`, { x: l.x, y: l.y, duration: l.dur, ease: "sine.inOut", repeat: -1, yoyo: true });
          gsap.to(`[data-depth="${i}"]`, {
            yPercent: -l.depth * 100,
            ease: "none",
            scrollTrigger: { trigger: document.documentElement, start: "top top", end: "bottom bottom", scrub: 0.8 },
          });
        });

        gsap.to("[data-glow='gold']", { x: "8vw", y: "6vh", scale: 1.12, duration: 31, ease: "sine.inOut", repeat: -1, yoyo: true });
        gsap.to("[data-glow='sky']", { x: "-9vw", y: "-5vh", scale: 0.92, duration: 37, ease: "sine.inOut", repeat: -1, yoyo: true });

        // The gold point leans toward the pointer, late and softly. Fingers have no pointer, so phones skip it.
        const summit = root.current?.querySelector<HTMLElement>("[data-summit]");
        if (summit && window.matchMedia("(pointer: fine)").matches) {
          const qx = gsap.quickTo(summit, "x", { duration: 1.4, ease: "power3.out" });
          const qy = gsap.quickTo(summit, "y", { duration: 1.4, ease: "power3.out" });
          const move = (e: PointerEvent) => {
            qx((e.clientX / window.innerWidth - 0.5) * 60);
            qy((e.clientY / window.innerHeight - 0.5) * 40);
          };
          window.addEventListener("pointermove", move, { passive: true });
          return () => window.removeEventListener("pointermove", move);
        }
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden">
      <div
        data-glow="sky"
        className="absolute -top-[18vmax] -inset-e-[14vmax] size-[58vmax] rounded-full"
        style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--color-line-ae) 13%, transparent), transparent)" }}
      />
      <div
        data-glow="gold"
        className="absolute -bottom-[22vmax] -inset-s-[16vmax] size-[62vmax] rounded-full"
        style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--color-summit) 17%, transparent), transparent)" }}
      />
      <div data-summit className="absolute top-[22vh] inset-e-[18vw]">
        <div
          className="size-3 rounded-full bg-summit"
          style={{ boxShadow: "0 0 0 10px color-mix(in srgb, var(--color-summit) 16%, transparent), 0 0 70px 24px color-mix(in srgb, var(--color-summit) 30%, transparent)" }}
        />
      </div>

      {LAYERS.map((l, i) => (
        <div key={l.seed} data-depth={i} className="absolute inset-x-0 bottom-0 h-[62vh]">
          <div data-drift={i} className="absolute inset-y-0 -inset-s-[15%] w-[130%]" style={{ opacity: l.opacity }}>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="size-full" fill="none">
              {l.paths.map((d, n) => (
                <path key={n} d={d} stroke="var(--color-contour-2)" strokeWidth={1.25} vectorEffect="non-scaling-stroke" opacity={1 - n * 0.28} />
              ))}
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}
