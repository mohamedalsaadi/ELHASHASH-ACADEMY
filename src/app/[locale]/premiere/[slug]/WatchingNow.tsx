"use client";

import { useEffect, useState } from "react";

/**
 * Pings the server every 30 s while the stream is open and shows the real "watching now" count once it is worth showing.
 * `label` holds the token __N__ where the number goes (a function cannot cross from the server).
 */
export function WatchingNow({ premiereId, min, label }: { premiereId: string; min: number; label: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let stop = false;
    const ping = () =>
      fetch(`/api/premiere/${premiereId}/seen`, { method: "POST" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { watching?: number } | null) => !stop && d?.watching != null && setN(d.watching))
        .catch(() => {});
    void ping();
    const timer = setInterval(ping, 30_000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [premiereId]);
  if (n < min) return null;
  return (
    <span className="num text-small font-semibold text-down" role="status">
      {label.replace("__N__", String(n))}
    </span>
  );
}
