import { pick } from "@/lib/content";
import { after } from "next/server";
import { Prisma, type NotificationKind } from "@/generated/prisma/client";
import { db } from "./db";
import { formatMoney } from "./format";
import { appUrl, emailLayout, sendMail } from "./mail";
import { isOptionalKind, unsubscribeUrl } from "./unsubscribe";

type NotificationInput = {
  userId: string;
  kind: NotificationKind;
  titleAr: string;
  titleEn: string;
  bodyAr?: string;
  bodyEn?: string;
  /** Site path, e.g. /orders/abc. */
  href?: string;
  /** Unique per event; a repeat is dropped instead of notifying twice. */
  dedupeKey?: string;
  email?: boolean;
};

/** Stores an in-app notice and emails the user once, if they have an address. */
export async function createNotification(input: NotificationInput) {
  const user = await db.user.findUnique({ where: { id: input.userId }, select: { email: true, locale: true, emailOptOutAt: true } });
  if (!user) return null;

  let notification;
  try {
    notification = await db.notification.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        titleAr: input.titleAr,
        titleEn: input.titleEn,
        bodyAr: input.bodyAr ?? null,
        bodyEn: input.bodyEn ?? null,
        href: input.href ?? null,
        dedupeKey: input.dedupeKey ?? null,
      },
    });
  } catch (e) {
    // The dedupeKey already exists: this reminder (or answer) was sent before.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null;
    throw e;
  }

  // Someone who unsubscribed still gets receipts and system mail, and still sees every notice in the app.
  if (input.email !== false && user.email && !(user.emailOptOutAt && isOptionalKind(input.kind))) {
    const to = user.email;
    const ar = user.locale === "ar";
    const title = pick(ar, input.titleAr, input.titleEn);
    const body = (pick(ar, input.bodyAr, input.bodyEn)) ?? null;
    const optional = isOptionalKind(input.kind);
    const unsubscribe = optional ? unsubscribeUrl(appUrl(), input.userId) : undefined;
    const cta = input.href ? { href: `${appUrl()}${input.href}`, label: ar ? "افتح ذروة" : "Open Dhirwa" } : undefined;
    // After the response: a slow mail provider must never hold up the action that caused the notice
    // (or stall a cron pass that sends dozens of them).
    after(async () => {
      const sent = await sendMail({
        to,
        subject: title,
        html: emailLayout(title, body ? [body] : [], cta, ar ? "ar" : "en", unsubscribe),
        unsubscribe,
      });
      if (sent) await db.notification.update({ where: { id: notification.id }, data: { emailedAt: new Date() } });
    });
  }

  return notification;
}

/** Receipt notice for a paid order; the email links to the printable receipt. */
export async function notifyOrderPaid(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, beneficiaryId: true, total: true, vat: true, currency: true },
  });
  if (!order) return;
  const paid = order.total + order.vat;
  await createNotification({
    userId: order.userId,
    kind: "ORDER_PAID",
    titleAr: "تم استلام دفعتك",
    titleEn: "Payment received",
    bodyAr: `تم تفعيل وصولك. المبلغ: ${formatMoney(paid, order.currency, "ar")}. الإيصال جاهز في حسابك.`,
    bodyEn: `Your access is active. Total: ${formatMoney(paid, order.currency, "en")}. Your receipt is ready in your account.`,
    href: `/orders/${order.id}`,
    dedupeKey: `order:${order.id}`,
  });
  // A parent may have paid for a student without a ParentLink. That is a gift: tell the learner,
  // not the payer, and never the other way round.
  if (order.beneficiaryId && order.beneficiaryId !== order.userId) {
    await createNotification({
      userId: order.beneficiaryId,
      kind: "ORDER_PAID",
      titleAr: "أهداك ولي أمرك دورة",
      titleEn: "A guardian bought you a course",
      bodyAr: "تم تفعيل وصولك. الإيصال جاهز في حسابك.",
      bodyEn: "Your access is active. Your receipt is ready in your account.",
      href: `/orders/${order.id}`,
      dedupeKey: `order-gift:${order.id}:${order.beneficiaryId}`,
    });
  }
}

/** One notice per question, even if the teacher edits the answer later. */
export async function notifyAnswer(questionId: string) {
  const q = await db.question.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      userId: true,
      lesson: { select: { id: true, titleAr: true, titleEn: true, unit: { select: { course: { select: { slug: true } } } } } },
    },
  });
  if (!q) return;
  await createNotification({
    userId: q.userId,
    kind: "ANSWER",
    titleAr: "أجاب معلمك على سؤالك",
    titleEn: "Your teacher answered your question",
    bodyAr: q.lesson.titleAr,
    bodyEn: q.lesson.titleEn,
    href: `/courses/${q.lesson.unit.course.slug}/lessons/${q.lesson.id}`,
    dedupeKey: `answer:${q.id}`,
  });
}

/** Tells every owner account; `dedupeKey` gets the admin id appended so each admin is told once. */
export async function notifyAdmins(input: Omit<NotificationInput, "userId" | "dedupeKey"> & { dedupeKey: string }) {
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  for (const a of admins) await createNotification({ ...input, userId: a.id, dedupeKey: `${input.dedupeKey}:${a.id}` });
}
