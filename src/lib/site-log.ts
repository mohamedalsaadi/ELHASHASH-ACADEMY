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
};

const KEEP_DAYS = 30;

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
    // Retention without a cron: now and then the writer trims the table it fills.
    if (Math.random() < 0.02) await db.siteLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) } } });
  } catch {
    // the log must never be the reason something else fails
  }
}
