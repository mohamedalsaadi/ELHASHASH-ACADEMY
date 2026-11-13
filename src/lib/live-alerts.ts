import { db } from "@/lib/db";
import { courseZone, formatWhen } from "@/lib/format";
import { createNotification } from "@/lib/notify";
import { opensLive } from "@/lib/plans";

const BATCH = 500;

/**
 * Tells every student of the course's grade (so the same country) that a live session is scheduled: one in-app
 * notice each, no email, safe to run twice. Non-subscribers are included on purpose; the notice leads to the course page.
 */
export async function notifyLiveScheduled(sessionId: string) {
  const s = await db.liveSession.findUnique({
    where: { id: sessionId },
    select: { titleAr: true, titleEn: true, cancelledAt: true, course: { select: { slug: true, published: true, gradeId: true, grade: { select: { country: true } } } } },
  });
  if (!s || s.cancelledAt || !s.course.published || !s.course.gradeId) return;
  let after: string | undefined;
  for (;;) {
    const students = await db.user.findMany({
      where: { role: "STUDENT", deletedAt: null, gradeId: s.course.gradeId },
      select: { id: true },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(after ? { cursor: { id: after }, skip: 1 } : {}),
    });
    if (students.length === 0) return;
    await db.notification.createMany({
      data: students.map((u) => ({
        userId: u.id,
        kind: "LIVE_SOON" as const,
        titleAr: `حصة مباشرة جديدة: ${s.titleAr}`,
        titleEn: `New live session: ${s.titleEn}`,
        href: `/courses/${s.course.slug}`,
        dedupeKey: `live-new:${sessionId}:${u.id}`,
      })),
      skipDuplicates: true,
    });
    if (students.length < BATCH) return;
    after = students[students.length - 1].id;
  }
}

/**
 * The same-day reminder: sessions starting in the next 24 hours go, with an email, to everyone whose plan opens them
 * (a seat, or a term-or-longer plan). Dedupe keys make a second run send nothing.
 */
export async function remindLiveToday(now = new Date()) {
  const sessions = await db.liveSession.findMany({
    where: { cancelledAt: null, startsAt: { gte: now, lt: new Date(now.getTime() + 24 * 3600_000) }, course: { published: true } },
    select: { id: true, titleAr: true, titleEn: true, startsAt: true, courseId: true, course: { select: { slug: true, grade: { select: { country: true } } } } },
  });
  let sent = 0;
  for (const s of sessions) {
    const grants = await db.entitlement.findMany({
      where: {
        courseId: s.courseId,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        user: { role: "STUDENT", deletedAt: null },
      },
      select: { userId: true, accessType: true, lessonId: true, liveSessionId: true, term: true, month: true, startsAt: true, endsAt: true },
    });
    const users = new Set(grants.filter((g) => opensLive(g, s.id, now)).map((g) => g.userId));
    const zone = courseZone(s.course);
    for (const userId of users) {
      const n = await createNotification({
        userId,
        kind: "LIVE_SOON",
        titleAr: `حصة مباشرة اليوم: ${s.titleAr}`,
        titleEn: `Live session today: ${s.titleEn}`,
        bodyAr: formatWhen(s.startsAt, zone, "ar"),
        bodyEn: formatWhen(s.startsAt, zone, "en"),
        href: `/live/${s.id}`,
        dedupeKey: `live-day:${s.id}:${userId}`,
      });
      if (n) sent += 1;
    }
  }
  return { sessions: sessions.length, sent };
}
