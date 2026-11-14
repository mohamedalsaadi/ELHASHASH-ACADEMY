// The daily teacher email: one message, only when something is waiting. Counts and links, no student names or message text.
import { db } from "./db";
import { appUrl, emailLayout, sendMail } from "./mail";
import { unsubscribeUrl } from "./unsubscribe";

const DAY = 24 * 3600_000;

export type Digest = { questions: number; reviews: number; homework: number; requests: number };

/** What is waiting for one teacher, as of `now`. Same scopes as the teacher pages: the teacher's own courses. */
export async function gatherDigest(teacherId: string, now = new Date()): Promise<Digest> {
  const own = { instructorId: teacherId };
  const [questions, reviews, homework, requests] = await Promise.all([
    db.question.count({ where: { answeredAt: null, lesson: { unit: { course: own } } } }),
    db.courseReview.count({ where: { status: "PUBLISHED", updatedAt: { gte: new Date(now.getTime() - DAY) }, course: own } }),
    db.submission.count({ where: { status: "SUBMITTED", submittedAt: { lt: new Date(now.getTime() - 2 * DAY) }, assignment: { course: own } } }),
    db.specialRequest.count({ where: { status: "OPEN", course: own } }),
  ]);
  return { questions, reviews, homework, requests };
}

export const digestTotal = (d: Digest) => d.questions + d.reviews + d.homework + d.requests;

/** The lines of the email, in one language. Empty queues are left out. */
export function digestLines(d: Digest, locale: "ar" | "en"): string[] {
  const ar = locale === "ar";
  const rows: [number, string, string][] = [
    [d.questions, "أسئلة طلاب تنتظر إجابتك", "student questions waiting for your answer"],
    [d.homework, "واجبات تنتظر التصحيح منذ أكثر من 48 ساعة", "homework waiting for grading for over 48 hours"],
    [d.requests, "طلبات من أولياء الأمور مفتوحة", "open parent requests"],
    [d.reviews, "تقييمات جديدة ظهرت على دوراتك", "new ratings now showing on your courses"],
  ];
  return rows.filter(([n]) => n > 0).map(([n, a, e]) => `${n} ${ar ? a : e}`);
}

/** Sends the digest to every teacher with an email who has not unsubscribed and has something waiting. */
export async function sendTeacherDigests(now = new Date()) {
  const teachers = await db.user.findMany({
    where: { role: "INSTRUCTOR", deletedAt: null, email: { not: null }, emailOptOutAt: null },
    select: { id: true, email: true, locale: true },
  });
  let sent = 0;
  for (const t of teachers) {
    const d = await gatherDigest(t.id, now);
    if (digestTotal(d) === 0 || !t.email) continue;
    const locale = t.locale === "en" ? "en" : "ar";
    const title = locale === "ar" ? "ما ينتظرك اليوم في ذروة" : "What is waiting for you on Dhirwa";
    const unsubscribe = unsubscribeUrl(appUrl(), t.id);
    const ok = await sendMail({
      to: t.email,
      subject: title,
      html: emailLayout(title, digestLines(d, locale), { href: `${appUrl()}/${locale}/teacher`, label: locale === "ar" ? "افتح لوحتك" : "Open your dashboard" }, locale, unsubscribe),
      unsubscribe,
    });
    if (ok) sent += 1;
  }
  return { teachers: teachers.length, sent };
}
