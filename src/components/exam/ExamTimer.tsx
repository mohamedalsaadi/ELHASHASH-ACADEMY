"use client";

import { useEffect, useRef, useState } from "react";

/** Counts down to the server-set expiry and submits the exam form once at zero. */
export function ExamTimer({ at, label, timeUp }: { at: string; label: string; timeUp: string }) {
  const [left, setLeft] = useState<number | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    const target = new Date(at).getTime();
    const tick = () => {
      const ms = target - Date.now();
      setLeft(Math.max(0, ms));
      if (ms <= 0 && !fired.current) {
        fired.current = true;
        document.querySelector<HTMLFormElement>("form[data-exam]")?.requestSubmit();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [at]);

  const s = Math.floor((left ?? 0) / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  const over = left !== null && left <= 0;

  return (
    <p role="timer" aria-live="off" className="num text-small">
      <span className="text-ink-muted">{label}: </span>
      <span className={over ? "font-semibold text-down" : "font-semibold"}>
        {left === null ? "--:--" : over ? timeUp : `${mm}:${ss}`}
      </span>
    </p>
  );
}
