"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Pings the server every 30 s while the stream is open and shows the real "watching now" count once it is worth showing.
 * `label` holds the token __N__ where the number goes (a function cannot cross from the server).
 * When the live window closes (`endsAt`), the page refreshes once so the attendee offer and the next stream appear.
 */
export function WatchingNow({ premiereId, min, label, endsAt }: { premiereId: string; min: number; label: string; endsAt?: string }) {
  const [n, setN] = useState(0);
  const router = useRouter();
  useEffect(() => {
    let stop = false;
    const ping = () =>
      fetch(`/api/premiere/${premiereId}/seen`, { method: "POST" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { watching?: number } | null) => !stop && d?.watching != null && setN(d.watching))
        .catch(() => {});
    void ping();
    const timer = setInterval(ping, 30_000);
    // A refresh mid-stream would reload the player, so it waits for the end (plus a moment for clock skew).
    const end = endsAt ? setTimeout(() => router.refresh(), Math.max(0, new Date(endsAt).getTime() - Date.now()) + 3_000) : undefined;
    return () => {
      stop = true;
      clearInterval(timer);
      clearTimeout(end);
    };
  }, [premiereId, endsAt, router]);
  if (n < min) return null;
  return (
    <span className="num text-small font-semibold text-down" role="status">
      {label.replace("__N__", String(n))}
    </span>
  );
}
