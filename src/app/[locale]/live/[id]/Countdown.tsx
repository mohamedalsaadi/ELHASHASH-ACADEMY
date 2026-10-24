"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Counts down to `at` and reloads the page when the room opens, which is when the server hands out the token. */
export function Countdown({ at, locale }: { at: string; locale: string }) {
  const router = useRouter();
  const target = new Date(at).getTime();
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const ms = target - Date.now();
      setLeft(Math.max(0, ms));
      if (ms <= 0) router.refresh();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target, router]);

  const n = new Intl.NumberFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en", { minimumIntegerDigits: 2 });
  const s = Math.floor((left ?? 0) / 1000);
  const parts = [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60];
  return (
    <p dir="ltr" role="timer" aria-live="off" className="num font-display text-display font-extrabold tracking-wide">
      {left === null ? "--:--:--" : `${parts[0] ? `${parts[0]}d ` : ""}${parts.slice(1).map((x) => n.format(x)).join(":")}`}
    </p>
  );
}
