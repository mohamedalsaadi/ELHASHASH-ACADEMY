import type { Prisma } from "@/generated/prisma/client";
import { logEvent } from "@/lib/site-log";

/** The name, a short message and (for database and Node errors) the code of anything that was thrown. Never a stack, never a request body. */
export function describeError(err: unknown): { name: string; message: string; code: string | null } {
  if (err && typeof err === "object") {
    const e = err as { name?: unknown; message?: unknown; code?: unknown };
    return {
      name: typeof e.name === "string" ? e.name : "Error",
      message: typeof e.message === "string" ? e.message : String(err),
      code: typeof e.code === "string" || typeof e.code === "number" ? String(e.code) : null,
    };
  }
  return { name: "Error", message: String(err), code: null };
}

export type LogErrorCtx = {
  /** What was being done, in plain words ("gateway intent create"). Facts only, never what a person typed. */
  message?: string;
  level?: "WARN" | "ERROR";
  path?: string | null;
  userId?: string | null;
  meta?: Prisma.InputJsonValue;
  /** Drop repeats of the same line inside this many ms on one server instance (rate-limit storms, a provider outage). */
  sample?: number;
};

/** Records a caught failure in the site log. Await it: a serverless function may stop right after the response. Never throws. */
export function logError(source: string, err: unknown, ctx: LogErrorCtx = {}): Promise<void> {
  const d = describeError(err);
  const text = `${ctx.message ? `${ctx.message}: ` : ""}${d.name}${d.code ? ` ${d.code}` : ""}: ${d.message.slice(0, 150)}`;
  return logEvent({ level: ctx.level ?? "ERROR", source, message: text, path: ctx.path, userId: ctx.userId, meta: ctx.meta, sample: ctx.sample });
}

/** Records a refusal or a state that is not an exception (an amount that does not match, a limit that was hit). */
export function logWarn(source: string, message: string, ctx: Omit<LogErrorCtx, "message"> = {}): Promise<void> {
  return logEvent({ level: ctx.level ?? "WARN", source, message, path: ctx.path, userId: ctx.userId, meta: ctx.meta, sample: ctx.sample });
}
