import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appUrl, emailLayout, sendMail } from "@/lib/mail";
import { createNotification } from "@/lib/notify";
import { unsubscribeUrl } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";

/**
 * The monthly guardian note. Runs on the 1st for the previous UTC month and sends one email per
 * linked parent, with a line per child. The in-app notification is the idempotency key: a re-run
 * for the same parent and month is skipped. A failed email deletes the note so the next run retries.
 *
 * ponytail: per-parent queries, fine at the current scale; batch by student ids if the parent count grows.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const period = start.toISOString().slice(0, 7);

  const links = await db.parentLink.findMany({
    select: {
      parent: { select: { id: true, email: true, locale: true, emailOptOutAt: true } },
      student: { select: { id: true, name: true } },
    },
  });
  const byParent = new Map<string, { parent: (typeof links)[number]["parent"]; students: { id: string; name: string }[] }>();
  for (const link of links) {
    const entry = byParent.get(link.parent.id) ?? { parent: link.parent, students: [] };
    entry.students.push(link.student);
    byParent.set(link.parent.id, entry);
  }

  let sent = 0;
  let skipped = 0;
  for (const { parent, students } of byParent.values()) {
    const note = await createNotification({
      userId: parent.id,
      kind: "SYSTEM",
      titleAr: "تقرير التقدم الشهري",
      titleEn: "Your monthly progress note",
      bodyAr: "تقرير تقدم أبنائك جاهز في لوحة ولي الأمر.",
      bodyEn: "Your children's progress note is ready in the parent dashboard.",
      href: "/parent",
      dedupeKey: `progress:${parent.id}:${period}`,
      email: false,
    });
    if (!note) {
      skipped += 1;
      continue;
    }
    // The in-app note above is enough for someone who turned optional email off.
    if (!parent.email || parent.emailOptOutAt) continue;

    const locale = parent.locale === "en" ? "en" : "ar";
    const month = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(start);
    const lines: string[] = [];

    for (const child of students) {
      const [lessons, homework, graded, exams, due] = await Promise.all([
        db.lessonView.count({ where: { userId: child.id, completedAt: { gte: start, lt: end } } }),
        db.submission.count({ where: { studentId: child.id, submittedAt: { gte: start, lt: end } } }),
        db.submission.findMany({
          where: { studentId: child.id, gradedAt: { gte: start, lt: end }, score: { not: null } },
          select: { score: true, assignment: { select: { maxScore: true } } },
        }),
        db.examAttempt.findMany({
          where: { userId: child.id, submittedAt: { gte: start, lt: end }, marks: { not: null } },
          select: { marks: true, maxMarks: true },
        }),
        db.reviewSchedule.count({ where: { userId: child.id, dueAt: { lte: now } } }),
      ]);

      const homeworkAverage = graded.length
        ? Math.round(graded.reduce((sum, s) => sum + ((s.score ?? 0) / (s.assignment.maxScore || 100)) * 100, 0) / graded.length)
        : null;
      const examAverage = exams.length
        ? Math.round(exams.reduce((sum, e) => sum + ((e.marks ?? 0) / (e.maxMarks || 100)) * 100, 0) / exams.length)
        : null;

      const parts =
        locale === "ar"
          ? [
              `${child.name}: ${lessons} ${lessons === 1 ? "درس مكتمل" : "دروس مكتملة"}`,
              ...(homework ? [`${homework} واجب مسلّم${homeworkAverage != null ? ` (متوسط ${homeworkAverage}٪)` : ""}`] : []),
              ...(exams.length ? [`${exams.length} اختبار${examAverage != null ? ` (متوسط ${examAverage}٪)` : ""}`] : []),
              ...(due ? [`${due} مراجعة مستحقة`] : []),
            ]
          : [
              `${child.name}: ${lessons} ${lessons === 1 ? "lesson" : "lessons"} completed`,
              ...(homework ? [`${homework} homework submitted${homeworkAverage != null ? ` (average ${homeworkAverage}%)` : ""}`] : []),
              ...(exams.length ? [`${exams.length} ${exams.length === 1 ? "exam" : "exams"} taken${examAverage != null ? ` (average ${examAverage}%)` : ""}`] : []),
              ...(due ? [`${due} ${due === 1 ? "review" : "reviews"} due`] : []),
            ];
      lines.push(parts.join(locale === "ar" ? "، " : ", "));
    }

    const title = locale === "ar" ? `تقدم أبنائك — ${month}` : `Your children's progress — ${month}`;
    const unsubscribe = unsubscribeUrl(appUrl(), parent.id);
    const ok = await sendMail({
      to: parent.email,
      subject: title,
      unsubscribe,
      html: emailLayout(
        title,
        lines,
        { href: `${appUrl()}/${locale}/parent`, label: locale === "ar" ? "افتح لوحة ولي الأمر" : "Open the parent dashboard" },
        locale,
        unsubscribe,
      ),
    });
    if (ok) sent += 1;
    else await db.notification.delete({ where: { id: note.id } }).catch(() => {});
  }

  return NextResponse.json({ ok: true, period, parents: byParent.size, sent, skipped });
}
