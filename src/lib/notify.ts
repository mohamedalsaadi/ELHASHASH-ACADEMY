import { Prisma, type NotificationKind } from "@/generated/prisma/client";
import { db } from "./db";
import { formatMoney } from "./format";
import { appUrl, emailLayout, sendMail } from "./mail";

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
  const user = await db.user.findUnique({ where: { id: input.userId }, select: { email: true, locale: true } });
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

  if (input.email !== false && user.email) {
    const ar = user.locale === "ar";
    const title = ar ? input.titleAr : input.titleEn;
    const body = (ar ? input.bodyAr : input.bodyEn) ?? null;
    const cta = input.href ? { href: `${appUrl()}${input.href}`, label: ar ? "افتح AAcademy" : "Open AAcademy" } : undefined;
    const sent = await sendMail({ to: user.email, subject: title, html: emailLayout(title, body ? [body] : [], cta, ar ? "ar" : "en") });
    if (sent) await db.notification.update({ where: { id: notification.id }, data: { emailedAt: new Date() } });
  }

  return notification;
}

/** Receipt notice for a paid order; the email links to the printable receipt. */
export async function notifyOrderPaid(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, total: true, currency: true },
  });
  if (!order) return;
  await createNotification({
    userId: order.userId,
    kind: "ORDER_PAID",
    titleAr: "تم استلام دفعتك",
    titleEn: "Payment received",
    bodyAr: `تم تفعيل وصولك. المبلغ: ${formatMoney(order.total, order.currency, "ar")}. الإيصال جاهز في حسابك.`,
    bodyEn: `Your access is active. Total: ${formatMoney(order.total, order.currency, "en")}. Your receipt is ready in your account.`,
    href: `/orders/${order.id}`,
    dedupeKey: `order:${order.id}`,
  });
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
