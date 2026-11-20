// Browser side of the site log. Sends one small JSON line to /api/log (which rate-limits and scrubs it).
// At most a handful per page load, and the same line only once, so a crash loop cannot flood the server.

const MAX_PER_PAGE = 5;
const sent = new Set<string>();

export type ClientSource = "client.error" | "client.unhandled" | "client.checkout" | "client.upload";

/** Reports a failure seen in the browser. Never throws and never waits. */
export function reportClient(source: ClientSource, message: string, extra?: { digest?: string }): void {
  try {
    if (typeof window === "undefined" || sent.size >= MAX_PER_PAGE) return;
    const text = message.slice(0, 300);
    const key = `${source}|${text}`;
    if (sent.has(key)) return;
    sent.add(key);
    const body = JSON.stringify({ source, level: "ERROR", message: text, path: window.location.pathname, meta: extra?.digest ? { digest: extra.digest.slice(0, 40) } : undefined });
    if (navigator.sendBeacon && navigator.sendBeacon("/api/log", new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/log", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    // reporting must never be the reason a page breaks
  }
}

// Code that is not ours, which made up much of the log: wallet extensions (window.ethereum), Firefox on iOS
// (__firefox__), Android in-app browsers ("Java object is gone") and iOS in-app bridges (webkit.messageHandlers).
const FOREIGN = /window\.ethereum|__firefox__|Java object is gone|webkit\.messageHandlers/;

/** True for an error raised by an injected or third-party script rather than by the site. */
export function isForeignError(message: string, filename: string | undefined, origin: string): boolean {
  if (FOREIGN.test(message)) return true;
  // Our scripts are served from our origin; anything else (a CDN widget, an extension, an in-app script) is not ours.
  return !!filename && !filename.startsWith(origin);
}

/** After a deploy an open tab can ask for a chunk that no longer exists. One reload per tab fetches the new build. */
export function reloadOnStaleChunk(e: unknown): boolean {
  const stale = e instanceof Error && (e.name === "ChunkLoadError" || /Loading (CSS )?chunk \S+ failed/.test(e.message));
  if (!stale) return false;
  try {
    if (sessionStorage.getItem("dh-chunk-reload")) return false;
    sessionStorage.setItem("dh-chunk-reload", "1");
  } catch {
    return false; // no storage, no loop guard: show the error page instead
  }
  window.location.reload();
  return true;
}

/** A short line for an Error or anything thrown. */
export function errorText(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}
