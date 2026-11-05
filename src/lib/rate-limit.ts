import { db } from "@/lib/db";

/** True when `key` already has `max` attempts inside the last `windowMs`. */
// ponytail: check-then-record is not atomic, so N parallel requests can overshoot by up to N.
// The overshoot is bounded and every caller does expensive work afterwards; move to a single
// INSERT ... SELECT WHERE count < max (or a serialisable transaction) if a limit ever guards
// something cheap enough to exploit in parallel.
export async function isLimited(key: string, max: number, windowMs: number) {
  const since = new Date(Date.now() - windowMs);
  return (await db.authAttempt.count({ where: { key, createdAt: { gt: since } } })) >= max;
}

/** Records one attempt and drops this key's rows older than a day. */
export async function recordAttempt(key: string) {
  await db.authAttempt.create({ data: { key } });
  await db.authAttempt.deleteMany({ where: { key, createdAt: { lt: new Date(Date.now() - 86_400_000) } } });
}
