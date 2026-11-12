"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Shows its children only while the lesson form's "kind" select is one of `kinds`, so a lesson shows the fields its kind
 * needs (video fields for a video, a pointer to the question workspace for practice questions) and nothing else.
 */
export function KindOnly({ kinds, savedKind, children }: { kinds: string[]; savedKind: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(kinds.includes(savedKind));
  useEffect(() => {
    const kind = box.current?.closest("form")?.elements.namedItem("kind");
    if (!(kind instanceof HTMLSelectElement)) return;
    const sync = () => setShow(kinds.includes(kind.value));
    sync();
    kind.addEventListener("change", sync);
    return () => kind.removeEventListener("change", sync);
  }, [kinds]);
  // Hidden, not removed: the form still posts the provider and video id, so a saved lesson keeps its video.
  return (
    <div ref={box} className={show ? "grid gap-3" : "hidden"}>
      {children}
    </div>
  );
}
