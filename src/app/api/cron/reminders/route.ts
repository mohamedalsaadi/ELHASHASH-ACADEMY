import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { average } from "@/lib/grades";
import { createNotification } from "@/lib/notify";

const DAY = 86_400_000;

/**
 * Expiry, live and weekly parent reminders. Vercel calls this with `Authorization: Bearer $CRON_SECRET`.
 * On the Hobby plan the schedule is daily, so the "1 hour" window is only exact when the job runs hourly.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();

  for (const days of [7, 3, 1]) {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
    const to = new Date(from.getTime() + DAY);
    const rows = await db.entitlement.findMany({
      where: { endsAt: { gte: from, lt: to }, course: { published: true } },
      select: { id: true, userId: true, course: { select: { titleAr: true, titleEn: true, slug: true } } },
    });
    for (const e of rows) {
      await createNotification({
        userId: e.userId,
        kind: "EXPIRING",
        titleAr: `اشتراكك في ${e.course.titleAr} ينتهي قريبًا`,
        titleEn: `Your ${e.course.titleEn} subscription ends soon`,
        bodyAr: `ينتهي الوصول بعد ${days} ${days === 1 ? "يوم" : "أيام"}. جدّد لتكمل.`,
        bodyEn: `Access ends in ${days} day${days === 1 ? "" : "s"}. Renew to keep going.`,
        href: `/courses/${e.course.slug}#packages`,
        dedupeKey: `exp:${e.id}:${days}`,
      });
    }
  }

  for (const hours of [24, 1]) {
    const from = new Date(now.getTime() + (hours - 0.5) * 3_600_000);
    const to = new Date(now.getTime() + (hours + 0.5) * 3_600_000);
    const sessions = await db.liveSession.findMany({
      where: { cancelledAt: null, startsAt: { gte: from, lt: to } },
      select: { id: true, courseId: true, titleAr: true, titleEn: true },
    });
    for (const s of sessions) {
      const grants = await db.entitlement.findMany({
        where: { courseId: s.courseId, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        select: { userId: true, accessType: true, lessonId: true, liveSessionId: true },
      });
      const userIds = new Set(
        grants
          .filter((g) => g.liveSessionId === s.id || (g.liveSessionId === null && g.lessonId === null && g.accessType !== "MONTHLY"))
          .map((g) => g.userId),
      );
      for (const userId of userIds) {
        await createNotification({
          userId,
          kind: "LIVE_SOON",
          titleAr: "حصة مباشرة قريبًا",
          titleEn: "Live lecture soon",
          bodyAr: s.titleAr,
          bodyEn: s.titleEn,
          href: `/live/${s.id}`,
          dedupeKey: `live:${s.id}:${userId}:${hours}`,
        });
      }
    }
  }

  // Weekly parent summary, sent with the Sunday run.
  if (now.getUTCDay() === 0) {
    const parents = await db.user.findMany({
      where: { role: "PARENT", parentLinks: { some: {} } },
      select: { id: true, parentLinks: { select: { student: { select: { id: true, name: true } } } } },
    });
    const weekStart = new Date(now.getTime() - 7 * DAY);
    const weekKey = now.toISOString().slice(0, 10);
    for (const p of parents) {
      const ar: string[] = [];
      const en: string[] = [];
      for (const link of p.parentLinks) {
        const [done, attended, graded, progress] = await Promise.all([
          db.lessonView.count({ where: { userId: link.student.id, completedAt: { gte: weekStart } } }),
          db.liveAttendance.count({ where: { userId: link.student.id, joinedAt: { gte: weekStart } } }),
          db.submission.findMany({
            where: { studentId: link.student.id, status: "GRADED", score: { not: null } },
            select: { score: true, assignment: { select: { maxScore: true } } },
            take: 200,
          }),
          db.studentProgress.findUnique({ where: { userId: link.student.id }, select: { xp: true, currentStreak: true } }),
        ]);
        const avg = average(graded.filter((g) => g.score !== null).map((g) => ({ value: g.score!, max: g.assignment.maxScore })));
        const streak = progress?.currentStreak ?? 0;
        ar.push(
          `${link.student.name}: ${done} حصة مكتملة، ${attended} حصة مباشرة، ${avg ? `متوسط الواجبات ${avg.avg}%` : "لا درجات واجبات بعد"}، ${streak} يوم متتالي`,
        );
        en.push(
          `${link.student.name}: ${done} lessons completed, ${attended} live sessions, ${avg ? `homework average ${avg.avg}%` : "no graded homework yet"}, ${streak}-day streak`,
        );
      }
      await createNotification({
        userId: p.id,
        kind: "SYSTEM",
        titleAr: "ملخص الأسبوع",
        titleEn: "Weekly summary",
        bodyAr: ar.join(" · "),
        bodyEn: en.join(" · "),
        href: "/parent",
        dedupeKey: `parent-week:${p.id}:${weekKey}`,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
