"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { RING_PATH } from "@/components/brand/Mark";

// three + R3F live in their own chunk, fetched only when canWebGL() says yes.
const BrandScene = dynamic(() => import("./BrandScene"), { ssr: false });

function canWebGL() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return false;
  if ((nav.hardwareConcurrency ?? 4) < 4 || (nav.deviceMemory ?? 4) < 4) return false;
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

// GSAP and three wait for the first scroll or touch, so page load stays free for the visitor.
function afterFirstInput(run: () => void) {
  const events = ["scroll", "wheel", "touchstart", "pointerdown", "keydown"];
  const stop = () => events.forEach((e) => removeEventListener(e, go));
  const go = () => {
    stop();
    run();
  };
  if (scrollY > 0) run();
  else events.forEach((e) => addEventListener(e, go, { passive: true }));
  return stop;
}

type Copy ={ before: [string, string]; after: [string, string]; steps: string[] };

/**
 * Home scroll scene: the ring descends onto the horizon, then the study steps sweep in along it.
 * Server HTML is the finished frame, so without JS or with reduced motion the scene is complete and still.
 */
export function HomeScene({ locale, copy }: { locale: string; copy: Copy }) {
  const root = useRef<HTMLElement>(null);
  const progress = useRef(1);
  const redraw = useRef(() => {}); // set by BrandScene; keeps R3F out of this chunk
  const [webgl, setWebgl] = useState(false);
  const rtl = locale === "ar";

  useEffect(() => {
    if (canWebGL()) return afterFirstInput(() => setWebgl(true));
  }, []);

  useEffect(() => {
    let revert = () => {};
    let cancelled = false;
    const stop = afterFirstInput(() => Promise.all([import("gsap"), import("gsap/ScrollTrigger"), import("gsap/CustomEase")]).then(
      ([{ gsap }, { ScrollTrigger }, { CustomEase }]) => {
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger, CustomEase);
        const ease = CustomEase.create("eh", "M0,0 C0.2,0.7 0.2,1 1,1"); // --ease-out
        const mm = gsap.matchMedia(root.current!);
        mm.add("(prefers-reduced-motion: no-preference)", () => {
          const tl = gsap.timeline({
            defaults: { ease },
            scrollTrigger: {
              trigger: root.current,
              start: "top top",
              end: "+=150%",
              pin: true,
              scrub: 0.6,
              onUpdate: (s) => {
                progress.current = s.progress;
                redraw.current();
              },
            },
          });
          tl.fromTo(".eh-s-line", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.35 }, 0)
            .fromTo(".eh-s-ring", { y: -14 }, { y: 0, duration: 0.35 }, 0.2)
            .fromTo(".eh-s-dot", { scale: 0 }, { scale: 1, duration: 0.05, transformOrigin: "50% 50%" }, 0.55)
            .fromTo(".eh-s-before", { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.1 }, 0.5)
            .fromTo(".eh-s-after", { autoAlpha: 0, y: 4 }, { autoAlpha: 1, y: 0, duration: 0.1 }, 0.55)
            .fromTo(".eh-s-steps", { autoAlpha: 0, x: rtl ? -40 : 40 }, { autoAlpha: 1, x: 0, duration: 0.15 }, 0.55)
            .fromTo(".eh-s-bar", { scaleX: 0 }, { scaleX: 1, duration: 0.08, stagger: 0.08 }, 0.7);
          return () => {
            progress.current = 1;
            redraw.current();
          };
        });
        revert = () => mm.revert();
      },
    ));
    return () => {
      stop();
      cancelled = true;
      revert();
    };
  }, [rtl]);

  return (
    <section ref={root} className="relative grid h-svh min-h-[480px] place-items-center overflow-hidden">
      <div className="absolute inset-x-0 top-12 mx-auto grid max-w-5xl px-4">
        <div className="eh-s-before invisible col-start-1 row-start-1 grid gap-1">
          <span className="text-label text-ink-muted">{copy.before[0]}</span>
          <h2 className="font-display text-h2 font-semibold text-balance">{copy.before[1]}</h2>
        </div>
        <div className="eh-s-after col-start-1 row-start-1 grid gap-1">
          <span className="text-label text-ink-muted">{copy.after[0]}</span>
          <h2 className="font-display text-h2 font-semibold text-balance">{copy.after[1]}</h2>
        </div>
      </div>

      <div className="relative aspect-square w-[min(320px,70vw)]">
        {webgl && <BrandScene progress={progress} redraw={redraw} rtl={rtl} />}
        <svg
          viewBox="0 0 48 48"
          aria-hidden="true"
          className={`size-full transition-opacity duration-(--dur-base) ease-(--ease-out) ${webgl ? "opacity-0" : ""}`}
        >
          <path
            className="eh-s-line stroke-amber"
            pathLength={1}
            strokeDasharray={1}
            d={rtl ? "M47 31H1" : "M1 31H47"}
            fill="none"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <g className="eh-s-ring">
            <path className="stroke-ink" d={RING_PATH} fill="none" strokeWidth="1.2" />
          </g>
          <circle className="eh-s-dot fill-amber" cx="24" cy="31" r="1.2" />
        </svg>
      </div>

      <ol className="eh-s-steps absolute inset-x-0 bottom-16 mx-auto flex max-w-5xl flex-wrap justify-center gap-x-6 gap-y-3 px-4 sm:gap-x-10">
        {copy.steps.map((s) => (
          <li key={s} className="relative pt-2 font-display text-label text-ink-muted">
            <span className="absolute inset-x-0 top-0 h-0.5 bg-hairline" />
            <span className="eh-s-bar absolute inset-x-0 top-0 h-0.5 origin-[right] bg-amber ltr:origin-[left]" />
            {s}
          </li>
        ))}
      </ol>
    </section>
  );
}
