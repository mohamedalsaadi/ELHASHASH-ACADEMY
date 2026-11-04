import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { average } from "@/lib/grades";
import { formatMoney } from "@/lib/format";
import { liveOffered } from "@/lib/live";
import { createNotification, notifyAdmins } from "@/lib/notify";
import { writeWeeklyNote } from "@/lib/parent-report";

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

  // Housekeeping once an hour: forget behaviour events older than 180 days.
  if (now.getUTCMinutes() < 10) {
    await db.analyticsEvent.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 180 * DAY) } } });
  }

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

  // A day before and fifteen minutes before. The 15-minute window is 5–25 minutes out, so a
  // 10-minute scheduler cannot step over it; an overlapping run is collapsed by the dedupe key.
  const windows = [
    { key: "24h", targetMin: 24 * 60, halfMin: 30 },
    { key: "15m", targetMin: 15, halfMin: 10 },
  ];
  for (const w of windows) {
    const from = new Date(now.getTime() + (w.targetMin - w.halfMin) * 60_000);
    const to = new Date(now.getTime() + (w.targetMin + w.halfMin) * 60_000);
    const sessions = await db.liveSession.findMany({
      // Never remind anyone about a teacher an admin has not approved for live.
      where: { ...liveOffered, startsAt: { gte: from, lt: to } },
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
          dedupeKey: `live:${s.id}:${userId}:${w.key}`,
        });
      }
    }
  }

  // Weekly parent summary. The hour guard matters when an external scheduler calls this every ten
  // minutes: without it the block would run ~144 times each Sunday.
  if (now.getUTCDay() === 0 && now.getUTCHours() === 5) {
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
        const [done, attended, graded, progress, exams] = await Promise.all([
          db.lessonView.count({ where: { userId: link.student.id, completedAt: { gte: weekStart } } }),
          db.liveAttendance.count({ where: { userId: link.student.id, joinedAt: { gte: weekStart } } }),
          db.submission.findMany({
            where: { studentId: link.student.id, status: "GRADED", score: { not: null } },
            orderBy: { gradedAt: "desc" },
            select: { score: true, feedback: true, gradedAt: true, assignment: { select: { maxScore: true } } },
            take: 200,
          }),
          db.studentProgress.findUnique({ where: { userId: link.student.id }, select: { xp: true, currentStreak: true } }),
          db.examAttempt.count({ where: { userId: link.student.id, submittedAt: { gte: weekStart } } }),
        ]);
        const avg = average(graded.filter((g) => g.score !== null).map((g) => ({ value: g.score!, max: g.assignment.maxScore })));
        const streak = progress?.currentStreak ?? 0;
        // The name stays here; the model only sees numbers and the teacher's words.
        const note = await writeWeeklyNote({
          lessonsCompleted: done,
          liveAttended: attended,
          homeworkAverage: avg?.avg ?? null,
          streakDays: streak,
          examsSubmitted: exams,
          feedback: graded
            .filter((g) => g.feedback && g.gradedAt && g.gradedAt >= weekStart)
            .slice(0, 3)
            .map((g) => g.feedback!.slice(0, 500)),
        }).catch(() => null);
        if (note) {
          ar.push(`${link.student.name}: ${note.ar}`);
          en.push(`${link.student.name}: ${note.en}`);
          continue;
        }
        ar.push(
          `${link.student.name}: ${done} حصة مكتملة، ${attended} رابط حصة مباشرة، ${avg ? `متوسط الواجبات ${avg.avg}%` : "لا درجات واجبات بعد"}، ${streak} يوم متتالي`,
        );
        en.push(
          `${link.student.name}: ${done} lessons completed, ${attended} live links opened, ${avg ? `homework average ${avg.avg}%` : "no graded homework yet"}, ${streak}-day streak`,
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

  if (now.getUTCHours() === 5) await ownerBriefing(now);

  return NextResponse.json({ ok: true });
}

/** The owner's morning list: what came in and what is waiting. Plain numbers from the database. */
async function ownerBriefing(now: Date) {
  const since = new Date(now.getTime() - DAY);
  const stale = new Date(now.getTime() - 2 * DAY);
  const [revenue, signups, requests, tickets, homework, questions] = await Promise.all([
    db.ledgerEntry.groupBy({ by: ["currency"], where: { createdAt: { gte: since } }, _sum: { gross: true } }),
    db.user.count({ where: { role: { in: ["STUDENT", "PARENT"] }, createdAt: { gte: since } } }),
    db.specialRequest.count({ where: { status: "OPEN" } }),
    db.supportTicket.count({ where: { status: "OPEN" } }),
    db.submission.count({ where: { status: "SUBMITTED", submittedAt: { lt: stale } } }),
    db.question.count({ where: { answer: null, createdAt: { lt: stale } } }),
  ]);
  const money = (l: "ar" | "en") =>
    revenue.length ? revenue.map((r) => formatMoney(r._sum.gross ?? 0, r.currency, l)).join("، ") : "0";
  await notifyAdmins({
    kind: "SYSTEM",
    titleAr: "ملخص الصباح",
    titleEn: "Morning briefing",
    bodyAr: `آخر 24 ساعة: مبيعات ${money("ar")}، ${signups} حساب جديد. بانتظارك: ${requests} طلب، ${tickets} رسالة دعم. متأخر أكثر من يومين: ${homework} واجب بدون تصحيح، ${questions} سؤال بدون رد.`,
    bodyEn: `Last 24 hours: sales ${money("en")}, ${signups} new accounts. Waiting for you: ${requests} requests, ${tickets} support messages. Over two days old: ${homework} homework ungraded, ${questions} questions unanswered.`,
    href: "/admin",
    dedupeKey: `brief:${now.toISOString().slice(0, 10)}`,
  });
}
