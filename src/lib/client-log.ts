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

/** A short line for an Error or anything thrown. */
export function errorText(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}
