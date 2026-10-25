"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Focuses the page container after a client navigation and announces the new document title. */
export function RouteAnnouncer() {
  const pathname = usePathname();
  const first = useRef(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.getElementById("main-content")?.focus({ preventScroll: true });
    const id = window.setTimeout(() => setMessage(document.title), 60);
    return () => window.clearTimeout(id);
  }, [pathname]);

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
