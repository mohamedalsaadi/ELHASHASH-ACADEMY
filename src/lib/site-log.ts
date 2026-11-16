import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type LogInput = {
  level?: "INFO" | "WARN" | "ERROR";
  /** Dotted origin, e.g. "vdocipher.upload" or "server.error". */
  source: string;
  message: string;
  path?: string | null;
  userId?: string | null;
  meta?: Prisma.InputJsonValue;
  /** Skip a repeat of the same source and message seen within this many ms on this server instance. */
  sample?: number;
};

export const KEEP_DAYS = 30;

const seen = new Map<string, number>();

/** True when this exact line was already written inside the window; also remembers it. The map is swept when it grows. */
export function repeated(key: string, windowMs: number, now = Date.now()): boolean {
  const last = seen.get(key);
  if (last !== undefined && now - last < windowMs) return true;
  if (seen.size > 500) for (const [k, t] of seen) if (now - t > windowMs) seen.delete(k);
  seen.set(key, now);
  return false;
}

/** Query strings can carry tokens and codes: drop them from anything that is stored. */
export function scrub(text: string, max: number): string {
  return text.replace(/\?[^\s"')]*/g, "").slice(0, max);
}

/**
 * Records one event. Never throws and never blocks the feature it describes.
 * Callers pass plain facts (step, status code, ids), never what a person typed.
 */
export async function logEvent(e: LogInput): Promise<void> {
  try {
    if (e.sample && repeated(`${e.source}|${e.message}`, e.sample)) return;
    await db.siteLog.create({
      data: {
        level: e.level ?? "INFO",
        source: e.source.slice(0, 60),
        message: scrub(e.message, 500),
        path: e.path ? scrub(e.path, 200) : null,
        userId: e.userId ?? null,
        meta: e.meta,
      },
    });
    // Retention without a cron: now and then the writer trims the table it fills. The retention cron does the same for a quiet site.
    if (Math.random() < 0.02) await db.siteLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) } } });
  } catch {
    // the log must never be the reason something else fails
  }
}
