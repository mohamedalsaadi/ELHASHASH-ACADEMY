// The chief of staff's morning briefing: numbers come from SQL, the model only writes the summary around them.
// Nothing personal goes to the model: counts, money totals and session titles, never names or message text.
import { z } from "zod";
import type { Currency } from "@/generated/prisma/client";
import { askJson } from "./ai";
import { logAiRun } from "./ai-log";
import { db } from "./db";
import { formatMoney } from "./format";
import { appUrl, emailLayout, sendMail } from "./mail";
import { createNotification } from "./notify";
import { readyPayoutCount } from "./payouts";
import { CONTACT_EMAIL } from "./site";

const DAY = 24 * 3600_000;

export type Briefing = {
  revenue: { currency: Currency; gross: number; entries: number }[];
  failedPayments: number;
  newStudents: number;
  openTickets: number;
  ticketsNeedYou: number;
  openRequests: number;
  heldReviews: number;
  pendingTeachers: number;
  unansweredQuestions: number;
  oldestQuestionHours: number | null;
  ungradedHomework: number;
  coursesPublished: number;
  payoutsReady: number;
  liveToday: { title: string; startsAt: Date }[];
};

/** What needs the owner, as of `now`. Counts only; cheap enough to run on every page view. */
export async function gatherBriefing(now = new Date()): Promise<Briefing> {
  const since = new Date(now.getTime() - DAY);
  const [revenue, failedPayments, newStudents, openTickets, ticketsNeedYou, openRequests, heldReviews, pendingTeachers, unanswered, oldest, ungradedHomework, coursesPublished, payoutsReady, live] = await Promise.all([
    db.ledgerEntry.groupBy({ by: ["currency"], where: { createdAt: { gte: since } }, _sum: { gross: true }, _count: true }),
    db.order.count({ where: { status: "FAILED", createdAt: { gte: since } } }),
    db.user.count({ where: { role: "STUDENT", createdAt: { gte: since } } }),
    db.supportTicket.count({ where: { status: "OPEN" } }),
    db.supportTicket.count({ where: { status: "OPEN", aiFlag: { not: null } } }),
    db.specialRequest.count({ where: { status: "OPEN" } }),
    db.courseReview.count({ where: { status: "HELD" } }),
    db.teacherApplication.count({ where: { status: "PENDING" } }),
    db.question.count({ where: { answeredAt: null } }),
    db.question.findFirst({ where: { answeredAt: null }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    db.submission.count({ where: { status: "SUBMITTED", submittedAt: { lt: new Date(now.getTime() - 2 * DAY) } } }),
    db.analyticsEvent.count({ where: { name: "course_published", createdAt: { gte: since } } }),
    readyPayoutCount(),
    db.liveSession.findMany({ where: { cancelledAt: null, startsAt: { gte: now, lt: new Date(now.getTime() + DAY) } }, orderBy: { startsAt: "asc" }, select: { titleEn: true, startsAt: true } }),
  ]);
  return {
    revenue: revenue.map((r) => ({ currency: r.currency, gross: r._sum.gross ?? 0, entries: r._count })),
    failedPayments,
    newStudents,
    openTickets,
    ticketsNeedYou,
    openRequests,
    heldReviews,
    pendingTeachers,
    unansweredQuestions: unanswered,
    oldestQuestionHours: oldest ? Math.round((now.getTime() - oldest.createdAt.getTime()) / 3600_000) : null,
    ungradedHomework,
    coursesPublished,
    payoutsReady,
    liveToday: live.map((l) => ({ title: l.titleEn, startsAt: l.startsAt })),
  };
}

/** The briefing as plain lines, always available, with or without the model. */
export function briefingLines(b: Briefing, locale: "ar" | "en"): string[] {
  const ar = locale === "ar";
  const money = b.revenue.length ? b.revenue.map((r) => formatMoney(r.gross, r.currency, locale)).join(ar ? "، " : ", ") : ar ? "لا مبيعات" : "no sales";
  const lines = [ar ? `آخر 24 ساعة: ${money}، و${b.newStudents} طالب جديد.` : `Last 24 hours: ${money}, ${b.newStudents} new students.`];
  const todo: [number, string, string][] = [
    [b.failedPayments, "دفعات فشلت", "failed payments"],
    [b.openTickets, "رسائل دعم مفتوحة", "open support tickets"],
    [b.ticketsNeedYou, "منها تحتاج قرارك (استرداد أو دفع أو حساب)", "of them need your decision (refund, payment or account)"],
    [b.openRequests, "طلبات خاصة مفتوحة", "open special requests"],
    [b.heldReviews, "تقييمات منخفضة تنتظر قرارك", "low ratings waiting for your decision"],
    [b.pendingTeachers, "طلبات مدرّسين تنتظر", "teacher applications waiting"],
    [b.unansweredQuestions, "أسئلة طلاب بلا إجابة", "student questions unanswered"],
    [b.ungradedHomework, "واجبات لم تُصحَّح منذ أكثر من 48 ساعة", "homework ungraded for over 48 hours"],
    [b.coursesPublished, "دورات نُشرت خلال 24 ساعة", "courses published in the last 24 hours"],
    [b.payoutsReady, "كشوف معلمين جاهزة للدفع", "teacher statements ready to pay"],
  ];
  for (const [n, a, e] of todo) if (n > 0) lines.push(`${n} ${ar ? a : e}`);
  if (b.oldestQuestionHours && b.oldestQuestionHours >= 24) lines.push(ar ? `أقدم سؤال ينتظر منذ ${b.oldestQuestionHours} ساعة.` : `The oldest question has waited ${b.oldestQuestionHours} hours.`);
  if (b.liveToday.length) lines.push(ar ? `${b.liveToday.length} حصة مباشرة خلال 24 ساعة.` : `${b.liveToday.length} live sessions in the next 24 hours.`);
  if (lines.length === 1) lines.push(ar ? "لا شيء ينتظرك الآن." : "Nothing is waiting for you.");
  return lines;
}

const Summary = z.object({ ar: z.string().min(1).max(600), en: z.string().min(1).max(600) });

/** Two or three sentences in both languages about what matters most today; null when AI is off or fails. */
export async function summarise(b: Briefing) {
  const facts = { ...b, liveToday: b.liveToday.length, revenue: b.revenue.map((r) => ({ currency: r.currency, amount: r.gross / 100, entries: r.entries })) };
  const result = await askJson({
    system:
      'You write the owner morning briefing for Dhirwa, an online school. Use only the numbers given and never invent any. Two or three plain sentences, no markdown, no greeting. Say what needs attention first. Reply with JSON only: {"ar": string, "en": string}, the same briefing in Arabic and in English.',
    parts: [{ text: JSON.stringify(facts) }],
    schema: Summary,
    maxTokens: 1500,
    timeoutMs: 30_000,
  });
  if (result) await logAiRun({ kind: "briefing", model: result.model, tokensIn: result.usage.input, tokensOut: result.usage.output, status: result.data ? "OK" : "ERROR" });
  return result?.data ?? null;
}

/**
 * Sends the briefing to every admin: an in-app notice, and an email to those with an address (or to the site contact address
 * when none has one). A scheduled run is sent once a day; `manual` always sends.
 */
export async function sendBriefing(now = new Date(), manual = false) {
  const b = await gatherBriefing(now);
  const summary = await summarise(b);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(now);
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true, email: true, locale: true } });
  const anyEmail = admins.some((x) => x.email);
  let sent = 0;
  for (const a of admins) {
    const locale = a.locale === "en" ? "en" : "ar";
    const ar = locale === "ar";
    const title = ar ? "ملخص الصباح" : "Your morning briefing";
    const lines = [...(summary ? [ar ? summary.ar : summary.en] : []), ...briefingLines(b, locale)];
    const note = await createNotification({
      userId: a.id,
      kind: "SYSTEM",
      titleAr: "ملخص الصباح",
      titleEn: "Your morning briefing",
      bodyAr: summary?.ar ?? briefingLines(b, "ar")[0],
      bodyEn: summary?.en ?? briefingLines(b, "en")[0],
      href: "/admin/ai",
      email: false,
      dedupeKey: manual ? `briefing:manual:${now.getTime()}:${a.id}` : `briefing:${day}:${a.id}`,
    });
    if (!note) continue;
    sent += 1;
    const to = a.email ?? (anyEmail ? null : CONTACT_EMAIL);
    if (to) await sendMail({ to, subject: title, html: emailLayout(title, lines, { href: `${appUrl()}/${locale}/admin/ai`, label: ar ? "افتح لوحة المالك" : "Open the owner desk" }, locale) });
  }
  return { sent, aiSummary: !!summary };
}
