import { db } from "@/lib/db";

/** True when `key` already has `max` attempts inside the last `windowMs`. */
export async function isLimited(key: string, max: number, windowMs: number) {
  const since = new Date(Date.now() - windowMs);
  return (await db.authAttempt.count({ where: { key, createdAt: { gt: since } } })) >= max;
}

/** Records one attempt and drops this key's rows older than a day. */
export async function recordAttempt(key: string) {
  await db.authAttempt.create({ data: { key } });
  await db.authAttempt.deleteMany({ where: { key, createdAt: { lt: new Date(Date.now() - 86_400_000) } } });
}
