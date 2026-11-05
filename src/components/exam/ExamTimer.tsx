"use client";

import { useEffect, useRef, useState } from "react";

/** Counts down to the server-set expiry and submits the exam form once at zero. */
export function ExamTimer({ at, label, timeUp }: { at: string; label: string; timeUp: string }) {
  const [left, setLeft] = useState<number | null>(null);
  const fired = useRef(false);
  const warned = useRef({ five: false, one: false });
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    const target = new Date(at).getTime();
    const tick = () => {
      const ms = target - Date.now();
      setLeft(Math.max(0, ms));
      // Announce once at five minutes and once at one, so auto-submit is never a surprise.
      if (ms > 0 && ms <= 5 * 60_000 && !warned.current.five) {
        warned.current.five = true;
        setWarning("5");
      }
      if (ms > 0 && ms <= 60_000 && !warned.current.one) {
        warned.current.one = true;
        setWarning("1");
      }
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
    <>
    {/* Announced, unlike the per-second count, which would flood a screen reader. */}
    <span role="status" className="sr-only">
      {warning === "5" ? `${5} ${label}` : warning === "1" ? `${1} ${label}` : ""}
    </span>
    <p role="timer" aria-live="off" className="num text-small">
      <span className="text-ink-muted">{label}: </span>
      <span className={over ? "font-semibold text-down" : "font-semibold"}>
        {left === null ? "--:--" : over ? timeUp : `${mm}:${ss}`}
      </span>
    </p>
    </>
  );
}
