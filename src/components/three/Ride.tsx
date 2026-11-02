"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { RideCar } from "./ride-scene";

export type RideSubject = RideCar & { id: string; anchor: string; cta: string };

type Scene = ReturnType<typeof import("./ride-scene").createRide>;

/**
 * The student home hero: the subject ride (canvas, decorative) driven by a row of real buttons. The canvas only
 * draws when something moves; under reduced motion each choice jumps straight to the station.
 */
export function Ride({ subjects, rtl, countryCode, label }: { subjects: RideSubject[]; rtl: boolean; countryCode: string; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scene = useRef<{ s: Scene; kick: () => void } | null>(null);
  const [selected, setSelected] = useState(0);
  const chips = useRef<(HTMLButtonElement | null)[]>([]);
  const current = subjects[selected];
  const Arrow = rtl ? ArrowLeft : ArrowRight;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || subjects.length === 0) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const [THREE, { createRide }] = await Promise.all([import("three"), import("./ride-scene"), document.fonts?.ready]);
      if (disposed) return;
      const css = getComputedStyle(document.documentElement);
      const token = (name: string) => css.getPropertyValue(`--color-${name}`).trim();
      const probe = document.createElement("span");
      probe.className = "font-display";
      document.body.append(probe);
      const font = getComputedStyle(probe).fontFamily;
      probe.remove();

      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const small = innerWidth < 700;
      const s = createRide(THREE, canvas, {
        cars: subjects,
        rtl,
        small,
        font,
        colors: {
          rail: ["aurora-1", "aurora-3", "aurora-4", "aurora-5", "aurora-6"].map(token),
          card: token("night-2"),
          cardEdge: token("aurora-4"),
          ink: token("night-text"),
          muted: token("night-muted"),
          pen: token(`line-${countryCode.toLowerCase()}`) || token("aurora-1"),
          glow: token("aurora-5"),
        },
      });

      // Draw on demand: a frame loop runs only while a car is still easing in, and never off-screen.
      let raf = 0, last = 0, visible = true;
      const frame = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        raf = s.step(dt) && visible ? requestAnimationFrame(frame) : 0;
      };
      const kick = () => {
        if (reduce) return s.jump();
        if (!raf) {
          last = performance.now();
          raf = requestAnimationFrame(frame);
        }
      };
      scene.current = { s, kick };
      s.jump();

      const io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible) kick();
      });
      io.observe(canvas);

      // Drag to turn the ride; a short tap picks a car. Moving right carries the cars right in both directions.
      let down: { x: number; moved: number } | null = null;
      const dir = rtl ? 1 : -1;
      const onDown = (e: PointerEvent) => {
        down = { x: e.clientX, moved: 0 };
        canvas.setPointerCapture(e.pointerId);
      };
      const onMove = (e: PointerEvent) => {
        if (!down) return;
        const dx = e.clientX - down.x;
        down.x = e.clientX;
        down.moved += Math.abs(dx);
        s.nudge((dir * dx * 1.2) / canvas.clientWidth);
        if (reduce) s.jump();
        else kick();
      };
      const onUp = (e: PointerEvent) => {
        if (!down) return;
        const tap = down.moved < 6;
        down = null;
        if (tap) {
          const r = canvas.getBoundingClientRect();
          const i = s.pick(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
          if (i === null) return;
          if (i === s.nearest()) document.getElementById(subjects[i].anchor)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
          else setSelected(i);
          return;
        }
        setSelected(s.nearest());
        s.select(s.nearest());
        kick();
      };
      // Only a sideways wheel turns the ride; the page keeps its normal vertical scroll.
      let snap = 0;
      const onWheel = (e: WheelEvent) => {
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
        e.preventDefault();
        s.nudge((-dir * e.deltaX) / 1500);
        kick();
        clearTimeout(snap);
        snap = window.setTimeout(() => {
          setSelected(s.nearest());
          s.select(s.nearest());
          kick();
        }, 140);
      };
      const onResize = () => (s.resize(), s.jump());
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      addEventListener("resize", onResize);
      cleanup = () => {
        cancelAnimationFrame(raf);
        clearTimeout(snap);
        io.disconnect();
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
        canvas.removeEventListener("wheel", onWheel);
        removeEventListener("resize", onResize);
        scene.current = null;
        s.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [subjects, rtl, countryCode]);

  useEffect(() => {
    scene.current?.s.select(selected);
    scene.current?.kick();
  }, [selected]);

  // Roving focus over the subject buttons: arrows move along the row in reading direction.
  const onKey = (e: React.KeyboardEvent) => {
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1, Home: -selected, End: subjects.length - 1 - selected }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const i = (selected + step + subjects.length) % subjects.length;
    setSelected(i);
    chips.current[i]?.focus();
  };

  if (subjects.length === 0) return null;
  return (
    <div className="grid gap-5">
      <canvas ref={ref} aria-hidden="true" className="h-[19rem] w-full cursor-grab touch-pan-y active:cursor-grabbing sm:h-[24rem] lg:h-[28rem]" />
      <div role="group" aria-label={label} onKeyDown={onKey} className="flex flex-wrap justify-center gap-2">
        {subjects.map((s, i) => (
          <button
            key={s.id}
            ref={(el) => {
              chips.current[i] = el;
            }}
            type="button"
            tabIndex={i === selected ? 0 : -1}
            aria-pressed={i === selected}
            onClick={() => setSelected(i)}
            className={`min-h-11 rounded-full border px-4 text-small font-medium transition-colors duration-(--dur-fast) ease-(--ease-out) ${
              i === selected ? "border-night-text bg-night-text text-night" : "border-night-muted/40 text-night-text hover:border-night-text"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>
      {current && (
        <a href={`#${current.anchor}`} className="btn btn-glow justify-self-center">
          {current.cta}
          <Arrow aria-hidden="true" className="size-4" strokeWidth={2.5} />
        </a>
      )}
    </div>
  );
}
