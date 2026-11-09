// Server errors to Sentry over its plain HTTP envelope API: no SDK, no build wrapper, off until SENTRY_DSN is set.
// ponytail: server-side request errors only; add the browser SDK if client-side crashes need tracking.

export function parseDsn(dsn: string): { url: string; auth: string } | null {
  const m = /^https:\/\/([^@]+)@([^/]+)\/(\d+)$/.exec(dsn.trim());
  if (!m) return null;
  return { url: `https://${m[2]}/api/${m[3]}/envelope/`, auth: `Sentry sentry_version=7, sentry_key=${m[1]}, sentry_client=dhirwa/1` };
}

export function envelope(dsn: string, err: unknown, extra: { path?: string; method?: string; route?: string; kind?: string }): string {
  const e = err instanceof Error ? err : new Error(String(err));
  const id = crypto.randomUUID().replace(/-/g, "");
  const event = {
    event_id: id,
    timestamp: Date.now() / 1000,
    platform: "node",
    level: "error",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    exception: { values: [{ type: e.name, value: e.message, stacktrace: { frames: frames(e.stack) } }] },
    // the path only: query strings can carry tokens, and no user data is sent
    request: { url: extra.path?.split("?")[0], method: extra.method },
    tags: { route: extra.route, kind: extra.kind, digest: (e as { digest?: string }).digest },
  };
  return `${JSON.stringify({ event_id: id, dsn })}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}\n`;
}

function frames(stack?: string) {
  // Sentry wants the innermost frame last
  return (stack ?? "").split("\n").slice(1, 30).map((l) => ({ function: l.trim().replace(/^at /, "") })).reverse();
}

export async function report(err: unknown, extra: Parameters<typeof envelope>[2]) {
  const dsn = process.env.SENTRY_DSN;
  const target = dsn ? parseDsn(dsn) : null;
  if (!dsn || !target) return;
  try {
    await fetch(target.url, { method: "POST", headers: { "X-Sentry-Auth": target.auth, "Content-Type": "application/x-sentry-envelope" }, body: envelope(dsn, err, extra) });
  } catch {
    // reporting must never break the request it is reporting on
  }
}
