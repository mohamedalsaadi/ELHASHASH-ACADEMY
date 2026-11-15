import type { Instrumentation } from "next";
import { report } from "@/lib/sentry";

export function register() {}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  await report(err, { path: request.path, method: request.method, route: context.routePath, kind: context.routeType });
  // The site log needs the database client, which only exists on the Node runtime.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logEvent } = await import("@/lib/site-log");
    const e = err instanceof Error ? err : new Error(String(err));
    await logEvent({
      level: "ERROR",
      source: "server.error",
      message: `${e.name}: ${e.message}`,
      path: request.path,
      meta: { route: context.routePath, kind: context.routeType, method: request.method, digest: (e as { digest?: string }).digest ?? null },
    });
  }
};
