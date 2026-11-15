import { db } from "@/lib/db";

// Everything the owner's Insights page shows, read from data the platform already stores. Read-only.
// Days are Dubai days (UTC+4, no daylight saving), the same clock as the rest of the office.

const DAY = 86_400_000;
const DUBAI = 4 * 3_600_000;
export const dubaiDay = (d: Date) => new Date(d.getTime() + DUBAI).toISOString().slice(0, 10);

export type Point = { d: string; n: number };

/** One point per day for the last `days` days, zeros where nothing happened, so a chart never skips a day. */
export function fillDays(rows: Point[], days: number, now = new Date()): Point[] {
  const by = new Map(rows.map((r) => [r.d, r.n]));
  return Array.from({ length: days }, (_, i) => {
    const d = dubaiDay(new Date(now.getTime() - (days - 1 - i) * DAY));
    return { d, n: by.get(d) ?? 0 };
  });
}

export type CourseRow = { id: string; titleAr: string; titleEn: string; views: number; buyers: number; lessonViews: number; completed: number; rating: number | null; ratings: number };
export type LessonRow = { id: string; titleAr: string; titleEn: string; courseAr: string; courseEn: string; views: number; completed: number };
export type PracticeRow = { id: string; titleAr: string; titleEn: string; courseAr: string; courseEn: string; attempts: number; avgPct: number };

export type Insights = {
  days: number;
  signups: Point[];
  signupsByCountry: { code: string; nameAr: string; nameEn: string; n: number }[];
  activation: { total: number; learned: number; enrolled: number };
  orders: Point[];
  revenue: { currency: string; total: number; series: Point[] }[];
  funnel: { name: string; n: number }[];
  signupFunnel: { name: string; n: number }[];
  plays: Point[];
  playsByHour: number[];
  playsByCountry: { code: string; n: number }[];
  weekly: Point[];
  mobile: { mobile: number; total: number };
  courses: CourseRow[];
  slowLessons: LessonRow[];
  hardPractice: PracticeRow[];
  support: { daily: Point[]; open: number; avgReplyHours: number | null; total: number };
  errors: { daily: Point[]; bySource: { source: string; n: number }[]; total: number };
  heldReviews: number;
};

const num = (x: unknown) => Number(x ?? 0);

export async function loadInsights(days: number, now = new Date()): Promise<Insights> {
  const since = new Date(now.getTime() - days * DAY);
  const since8w = new Date(now.getTime() - 56 * DAY);
  const q = <T,>(p: Promise<unknown>) => p as Promise<T>;

  const [signups, byCountry, act, ordersD, actors, plays, hours, pCountry, weekly, dev, courses, slow, hard, tickets, ticketStats, errD, errS, held] = await Promise.all([
    q<Point[]>(db.$queryRaw`SELECT to_char(("createdAt" AT TIME ZONE 'Asia/Dubai')::date,'YYYY-MM-DD') d, count(*)::int n FROM "User" WHERE role='STUDENT' AND "createdAt" >= ${since} GROUP BY 1`),
    q<Insights["signupsByCountry"]>(db.$queryRaw`SELECT ct.code, ct."nameAr", ct."nameEn", count(*)::int n FROM "User" u JOIN "Grade" g ON g.id=u."gradeId" JOIN "Country" ct ON ct.id=g."countryId" WHERE u.role='STUDENT' AND u."createdAt" >= ${since} GROUP BY 1,2,3 ORDER BY n DESC`),
    q<{ total: number; learned: number; enrolled: number }[]>(db.$queryRaw`SELECT count(*)::int total,
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "LessonView" v WHERE v."userId"=u.id))::int learned,
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Entitlement" e WHERE e."userId"=u.id))::int enrolled
      FROM "User" u WHERE u.role='STUDENT' AND u."createdAt" >= ${since}`),
    q<{ d: string; c: string; n: number; s: number }[]>(db.$queryRaw`SELECT to_char(("paidAt" AT TIME ZONE 'Asia/Dubai')::date,'YYYY-MM-DD') d, currency::text c, count(*)::int n, sum(total)::float8 s FROM "Order" WHERE status='PAID' AND total>0 AND "paidAt" >= ${since} GROUP BY 1,2`),
    q<{ name: string; n: number }[]>(db.$queryRaw`SELECT name, count(DISTINCT coalesce("userId","sessionId"))::int n FROM "AnalyticsEvent" WHERE "createdAt" >= ${since} GROUP BY 1`),
    q<Point[]>(db.$queryRaw`SELECT to_char((at AT TIME ZONE 'Asia/Dubai')::date,'YYYY-MM-DD') d, count(*)::int n FROM "PlayEvent" WHERE at >= ${since} GROUP BY 1`),
    q<{ h: number; n: number }[]>(db.$queryRaw`SELECT extract(hour FROM (at AT TIME ZONE 'Asia/Dubai'))::int h, count(*)::int n FROM "PlayEvent" WHERE at >= ${since} GROUP BY 1`),
    q<{ code: string; n: number }[]>(db.$queryRaw`SELECT coalesce(country,'??') code, count(*)::int n FROM "PlayEvent" WHERE at >= ${since} GROUP BY 1 ORDER BY n DESC LIMIT 8`),
    q<Point[]>(db.$queryRaw`SELECT to_char(date_trunc('week', "lastSeenAt" AT TIME ZONE 'Asia/Dubai'),'YYYY-MM-DD') d, count(DISTINCT "userId")::int n FROM "LessonView" WHERE "lastSeenAt" >= ${since8w} GROUP BY 1 ORDER BY 1`),
    q<{ mobile: number; total: number }[]>(db.$queryRaw`SELECT count(*) FILTER (WHERE "userAgent" ~* '(mobi|android|iphone)')::int mobile, count(*)::int total FROM "DeviceSession" WHERE "lastSeenAt" >= ${since}`),
    q<CourseRow[]>(db.$queryRaw`SELECT c.id, c."titleAr", c."titleEn",
        (SELECT count(*) FROM "AnalyticsEvent" e WHERE e.name='course_viewed' AND e."courseId"=c.id AND e."createdAt" >= ${since})::int views,
        (SELECT count(DISTINCT o."userId") FROM "OrderItem" oi JOIN "Sku" s ON s.id=oi."skuId" JOIN "Order" o ON o.id=oi."orderId" WHERE s."courseId"=c.id AND o.status='PAID' AND o."paidAt" >= ${since})::int buyers,
        (SELECT count(*) FROM "LessonView" v JOIN "Lesson" l ON l.id=v."lessonId" JOIN "Unit" u ON u.id=l."unitId" WHERE u."courseId"=c.id)::int "lessonViews",
        (SELECT count(*) FROM "LessonView" v JOIN "Lesson" l ON l.id=v."lessonId" JOIN "Unit" u ON u.id=l."unitId" WHERE u."courseId"=c.id AND v."completedAt" IS NOT NULL)::int completed,
        (SELECT avg(r.stars)::float8 FROM "CourseReview" r WHERE r."courseId"=c.id AND r.status='PUBLISHED') rating,
        (SELECT count(*) FROM "CourseReview" r WHERE r."courseId"=c.id AND r.status='PUBLISHED')::int ratings
      FROM "Course" c WHERE c.published ORDER BY views DESC, buyers DESC LIMIT 30`),
    q<LessonRow[]>(db.$queryRaw`SELECT l.id, l."titleAr", l."titleEn", c."titleAr" "courseAr", c."titleEn" "courseEn", count(*)::int views, count(v."completedAt")::int completed
      FROM "LessonView" v JOIN "Lesson" l ON l.id=v."lessonId" JOIN "Unit" u ON u.id=l."unitId" JOIN "Course" c ON c.id=u."courseId"
      GROUP BY l.id, l."titleAr", l."titleEn", c."titleAr", c."titleEn" HAVING count(*) >= 5 ORDER BY (count(v."completedAt")::float8 / count(*)) ASC, count(*) DESC LIMIT 8`),
    q<PracticeRow[]>(db.$queryRaw`SELECT l.id, l."titleAr", l."titleEn", c."titleAr" "courseAr", c."titleEn" "courseEn", count(*)::int attempts, (avg(a.marks::float8 / nullif(a."maxMarks",0)) * 100)::float8 "avgPct"
      FROM "PracticeAttempt" a JOIN "Lesson" l ON l.id=a."lessonId" JOIN "Unit" u ON u.id=l."unitId" JOIN "Course" c ON c.id=u."courseId"
      WHERE a."createdAt" >= ${since} GROUP BY l.id, l."titleAr", l."titleEn", c."titleAr", c."titleEn" HAVING count(*) >= 5 ORDER BY avg(a.marks::float8 / nullif(a."maxMarks",0)) ASC LIMIT 8`),
    q<Point[]>(db.$queryRaw`SELECT to_char(("createdAt" AT TIME ZONE 'Asia/Dubai')::date,'YYYY-MM-DD') d, count(*)::int n FROM "SupportTicket" WHERE "createdAt" >= ${since} GROUP BY 1`),
    q<{ open: number; total: number; hrs: number | null }[]>(db.$queryRaw`SELECT count(*) FILTER (WHERE status='OPEN')::int open, count(*)::int total, (avg(extract(epoch FROM ("repliedAt" - "createdAt")) / 3600) FILTER (WHERE "repliedAt" IS NOT NULL))::float8 hrs FROM "SupportTicket" WHERE "createdAt" >= ${since}`),
    q<Point[]>(db.$queryRaw`SELECT to_char(("createdAt" AT TIME ZONE 'Asia/Dubai')::date,'YYYY-MM-DD') d, count(*)::int n FROM "SiteLog" WHERE level='ERROR' AND "createdAt" >= ${since} GROUP BY 1`),
    q<{ source: string; n: number }[]>(db.$queryRaw`SELECT source, count(*)::int n FROM "SiteLog" WHERE level='ERROR' AND "createdAt" >= ${since} GROUP BY 1 ORDER BY n DESC LIMIT 8`),
    q<{ n: number }[]>(db.$queryRaw`SELECT count(*)::int n FROM "CourseReview" WHERE status='HELD'`),
  ]);

  const actor = (name: string) => num(actors.find((a) => a.name === name)?.n);
  const byCur = new Map<string, { total: number; rows: Point[] }>();
  const orderCount = new Map<string, number>();
  for (const r of ordersD) {
    const c = byCur.get(r.c) ?? { total: 0, rows: [] };
    c.total += num(r.s);
    c.rows.push({ d: r.d, n: num(r.s) });
    byCur.set(r.c, c);
    orderCount.set(r.d, (orderCount.get(r.d) ?? 0) + num(r.n));
  }

  return {
    days,
    signups: fillDays(signups, days, now),
    signupsByCountry: byCountry,
    activation: { total: num(act[0]?.total), learned: num(act[0]?.learned), enrolled: num(act[0]?.enrolled) },
    orders: fillDays([...orderCount].map(([d, n]) => ({ d, n })), days, now),
    revenue: [...byCur].sort((a, b) => b[1].total - a[1].total).map(([currency, v]) => ({ currency, total: v.total, series: fillDays(v.rows, days, now) })),
    funnel: ["course_viewed", "checkout_started", "order_paid"].map((name) => ({ name, n: actor(name) })),
    signupFunnel: ["signup_viewed", "signup_completed"].map((name) => ({ name, n: actor(name) })),
    plays: fillDays(plays, days, now),
    playsByHour: Array.from({ length: 24 }, (_, h) => num(hours.find((x) => x.h === h)?.n)),
    playsByCountry: pCountry,
    weekly,
    mobile: { mobile: num(dev[0]?.mobile), total: num(dev[0]?.total) },
    courses,
    slowLessons: slow,
    hardPractice: hard,
    support: { daily: fillDays(tickets, days, now), open: num(ticketStats[0]?.open), avgReplyHours: ticketStats[0]?.hrs ?? null, total: num(ticketStats[0]?.total) },
    errors: { daily: fillDays(errD, days, now), bySource: errS, total: errD.reduce((a, r) => a + num(r.n), 0) },
    heldReviews: num(held[0]?.n),
  };
}

export type Weak = { key: "signupDrop" | "viewDrop" | "viewNoBuy" | "slowLesson" | "hardLesson" | "lowRating" | "slowReply" | "errors" | "heldReviews" | "noActivation"; vars: Record<string, string | number> };

/** Plain rules over the numbers above, so the page can say what needs attention without anyone reading every chart. */
export function weakSpots(d: Insights, ar: boolean): Weak[] {
  const pick = (a: string, e: string) => (ar ? a : e);
  const out: Weak[] = [];
  const [sv, sc] = [d.signupFunnel[0]?.n ?? 0, d.signupFunnel[1]?.n ?? 0];
  const [cv, cs] = [d.funnel[0]?.n ?? 0, d.funnel[1]?.n ?? 0];
  if (cv >= 50 && cs / cv < 0.05) out.push({ key: "viewDrop", vars: { pct: Math.round((cs / cv) * 100), seen: cv } });
  if (sv >= 20 && sc / sv < 0.3) out.push({ key: "signupDrop", vars: { pct: Math.round((1 - sc / sv) * 100), seen: sv } });
  if (d.activation.total >= 10 && d.activation.learned / d.activation.total < 0.4) out.push({ key: "noActivation", vars: { pct: Math.round((1 - d.activation.learned / d.activation.total) * 100), n: d.activation.total } });
  for (const c of d.courses) {
    if (c.views >= 20 && c.buyers === 0) out.push({ key: "viewNoBuy", vars: { name: pick(c.titleAr, c.titleEn), views: c.views } });
    if (c.ratings >= 3 && c.rating !== null && c.rating < 4) out.push({ key: "lowRating", vars: { name: pick(c.titleAr, c.titleEn), rating: c.rating.toFixed(1) } });
  }
  for (const l of d.slowLessons) if (l.completed / l.views < 0.3) out.push({ key: "slowLesson", vars: { name: pick(l.titleAr, l.titleEn), pct: Math.round((l.completed / l.views) * 100), views: l.views } });
  for (const p of d.hardPractice) if (p.avgPct < 50) out.push({ key: "hardLesson", vars: { name: pick(p.titleAr, p.titleEn), pct: Math.round(p.avgPct) } });
  if (d.support.avgReplyHours !== null && d.support.avgReplyHours > 48) out.push({ key: "slowReply", vars: { hours: Math.round(d.support.avgReplyHours) } });
  if (d.errors.total >= 10) out.push({ key: "errors", vars: { n: d.errors.total } });
  if (d.heldReviews > 0) out.push({ key: "heldReviews", vars: { n: d.heldReviews } });
  return out.slice(0, 12);
}
