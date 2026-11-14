"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Scroll motion for marketing pages, driven by data attributes so the pages stay server components. Everything is
 * complete at rest: with no JS or under reduced motion nothing here runs and every element is already visible.
 * Scroll stays native; nothing hijacks the wheel.
 *
 *   data-reveal            rises once as it enters
 *   data-scale-in          grows into place, tied to scroll
 *   data-steps             a sticky stage: each [data-step] scrolled past lights its matching [data-panel]
 */
export function Motion() {
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
        gsap.from(el, { y: 24, autoAlpha: 0, duration: 0.8, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } });
      });
      gsap.utils.toArray<HTMLElement>("[data-scale-in]").forEach((el) => {
        gsap.fromTo(el, { scale: 0.9 }, { scale: 1, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "top 25%", scrub: true } });
      });
    });

    // Sticky steps only where there is room for the panel beside the text; phones read the panels in the flow.
    mm.add({ wide: "(min-width: 1024px)", calm: "(prefers-reduced-motion: reduce)" }, (ctx) => {
      if (!ctx.conditions?.wide) return;
      const calm = ctx.conditions.calm;
      gsap.utils.toArray<HTMLElement>("[data-steps]").forEach((stage) => {
        const panels = gsap.utils.toArray<HTMLElement>("[data-panel]", stage);
        const show = (i: number) =>
          panels.forEach((p, n) => {
            gsap.to(p, { autoAlpha: n === i ? 1 : 0, y: calm || n === i ? 0 : n < i ? -16 : 16, duration: calm ? 0 : 0.45, ease: "power2.out", overwrite: true });
          });
        gsap.set(panels, { position: "absolute", inset: 0 });
        show(0);
        gsap.utils.toArray<HTMLElement>("[data-step]", stage).forEach((step, i) => {
          ScrollTrigger.create({ trigger: step, start: "top center", end: "bottom center", onToggle: (s) => s.isActive && show(i) });
          if (!calm) gsap.fromTo(step, { opacity: 0.55 }, { opacity: 1, ease: "none", scrollTrigger: { trigger: step, start: "top 75%", end: "top 50%", scrub: true } });
        });
      });
    });
    return () => mm.revert();
  });
  return null;
}
