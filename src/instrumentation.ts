import type { Instrumentation } from "next";
import { report } from "@/lib/sentry";

export function register() {}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  await report(err, { path: request.path, method: request.method, route: context.routePath, kind: context.routeType });
};
