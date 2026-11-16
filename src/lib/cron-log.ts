import { NextResponse } from "next/server";
import { logError, logWarn } from "@/lib/log-error";
import { logEvent } from "@/lib/site-log";

/**
 * Runs one cron job and leaves a heartbeat: an INFO line when it finished, an ERROR line when it threw (and rethrows,
 * so the route still answers 500). A day with no heartbeat for a job is itself a finding.
 */
export async function cronRun<T>(name: string, job: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    const out = await job();
    await logEvent({ source: `cron.${name}`, message: "finished", meta: { ms: Date.now() - t0 } });
    return out;
  } catch (e) {
    await logError(`cron.${name}`, e, { message: "failed", meta: { ms: Date.now() - t0 } });
    throw e;
  }
}

/**
 * Wraps a cron route: checks the shared secret, runs the job through `cronRun`, and logs a refused call as a WARN
 * (a wrong CRON_SECRET in Vercel would otherwise fail every job without a trace). Same signature as a route handler.
 */
export function cronRoute(name: string, handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    // A value pasted into a dashboard often carries a trailing space or line break, which an HTTP header cannot.
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || request.headers.get("authorization")?.trim() !== `Bearer ${secret}`) {
      await logWarn(`cron.${name}`, secret ? "refused: wrong Authorization header" : "refused: CRON_SECRET is not set on the server", { sample: 3_600_000 });
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return cronRun(name, () => handler(request));
  };
}
