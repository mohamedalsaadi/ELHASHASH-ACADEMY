// Counts for the free live streams, read from stored rows only (DESIGN.md: never invented numbers).
import { db } from "./db";
import { SEEN_WINDOW_SEC } from "./premiere";

/** Slugs of the course's streams that started before `before`, not cancelled. */
async function earlierSlugs(courseId: string, before: Date) {
  const rows = await db.premiere.findMany({ where: { courseId, startsAt: { lt: before }, cancelledAt: null }, select: { id: true, slug: true } });
  return rows;
}

/** Distinct signed-in students who reached the player of the course's earlier streams. */
export async function pastJoined(courseId: string, before: Date): Promise<number> {
  const slugs = (await earlierSlugs(courseId, before)).map((p) => p.slug);
  if (!slugs.length) return 0;
  const [r] = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(DISTINCT "userId") AS n FROM "AnalyticsEvent"
     WHERE name = 'premiere_joined' AND "userId" IS NOT NULL AND props->>'slug' = ANY(${slugs})`;
  return Number(r?.n ?? 0);
}

/** Who to tell about a new stream: anyone signed in who asked for a reminder, opened or joined an earlier stream of the course. */
export async function inviteRecipients(courseId: string, before: Date): Promise<string[]> {
  const earlier = await earlierSlugs(courseId, before);
  if (!earlier.length) return [];
  const [rsvps, events] = await Promise.all([
    db.premiereRsvp.findMany({ where: { premiereId: { in: earlier.map((p) => p.id) } }, select: { userId: true } }),
    db.$queryRaw<{ userId: string }[]>`
      SELECT DISTINCT "userId" FROM "AnalyticsEvent"
       WHERE name IN ('premiere_viewed', 'premiere_joined') AND "userId" IS NOT NULL AND props->>'slug' = ANY(${earlier.map((p) => p.slug)})`,
  ]);
  return [...new Set([...rsvps.map((r) => r.userId), ...events.map((e) => e.userId)])];
}

export type SourceRow = { src: string; visits: number; joined: number };

/** Page visits and joins per ad source (`?src=`), per stream slug. Visits are logged once per visitor per day. */
export async function sourceCounts(slugs: string[]): Promise<Map<string, SourceRow[]>> {
  const out = new Map<string, SourceRow[]>();
  if (!slugs.length) return out;
  const rows = await db.$queryRaw<{ slug: string; src: string; visits: bigint; joined: bigint }[]>`
    SELECT props->>'slug' AS slug, COALESCE(NULLIF(props->>'src', ''), 'direct') AS src,
           count(DISTINCT COALESCE("userId", "sessionId")) FILTER (WHERE name = 'premiere_viewed') AS visits,
           count(DISTINCT "userId") FILTER (WHERE name = 'premiere_joined') AS joined
      FROM "AnalyticsEvent"
     WHERE name IN ('premiere_viewed', 'premiere_joined') AND props->>'slug' = ANY(${slugs})
     GROUP BY 1, 2 ORDER BY 1, 3 DESC`;
  for (const r of rows) {
    const list = out.get(r.slug) ?? [];
    list.push({ src: r.src, visits: Number(r.visits), joined: Number(r.joined) });
    out.set(r.slug, list);
  }
  return out;
}

/** Signed-in viewers whose player pinged recently. */
export function watchingNow(premiereId: string, now = new Date()) {
  return db.premiereSeen.count({ where: { premiereId, seenAt: { gte: new Date(now.getTime() - SEEN_WINDOW_SEC * 1000) } } });
}
