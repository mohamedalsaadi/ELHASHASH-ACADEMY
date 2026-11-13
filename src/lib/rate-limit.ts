import { db } from "@/lib/db";

// Per-key attempt limits. With Upstash Redis configured (UPSTASH_REDIS_REST_URL / _TOKEN, or the KV_REST_API_* pair the Vercel
// integration adds) attempts live in Redis and cost the database nothing; without it, or when Redis fails, they use the AuthAttempt table.

const DAY_MS = 86_400_000;

const redisConfig = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
};

/** One round trip of Redis commands; null when Redis is not configured or did not answer, so callers fall back to the database. */
async function redis(commands: (string | number)[][]): Promise<{ result?: unknown; error?: string }[] | null> {
  const cfg = redisConfig();
  if (!cfg) return null;
  try {
    const res = await fetch(`${cfg.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(2_000),
    });
    if (!res.ok) return null;
    const out = (await res.json()) as { result?: unknown; error?: string }[];
    return out.some((o) => o.error) ? null : out;
  } catch {
    return null;
  }
}

/** True when `key` already has `max` attempts inside the last `windowMs`. */
// ponytail: check-then-record is not atomic, so N parallel requests can overshoot by up to N.
// The overshoot is bounded and every caller does expensive work afterwards; move to a single
// INSERT ... SELECT WHERE count < max (or a serialisable transaction) if a limit ever guards
// something cheap enough to exploit in parallel.
export async function isLimited(key: string, max: number, windowMs: number) {
  const since = Date.now() - windowMs;
  const out = await redis([["ZCOUNT", `rl:${key}`, `(${since}`, "+inf"]]);
  if (out) return Number(out[0].result) >= max;
  return (await db.authAttempt.count({ where: { key, createdAt: { gt: new Date(since) } } })) >= max;
}

/** Records one attempt and drops this key's entries older than a day. */
export async function recordAttempt(key: string) {
  const now = Date.now();
  const out = await redis([
    ["ZADD", `rl:${key}`, now, `${now}-${Math.random().toString(36).slice(2, 10)}`],
    ["ZREMRANGEBYSCORE", `rl:${key}`, "-inf", now - DAY_MS],
    ["PEXPIRE", `rl:${key}`, DAY_MS],
  ]);
  if (out) return;
  await db.authAttempt.create({ data: { key } });
  await db.authAttempt.deleteMany({ where: { key, createdAt: { lt: new Date(now - DAY_MS) } } });
}
