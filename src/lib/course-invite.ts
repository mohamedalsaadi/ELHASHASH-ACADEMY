import { MINOR_AGE } from "@/lib/age";
import { pick } from "@/lib/content";
import { db } from "@/lib/db";
import { loadCourseEmailData, renderCourseEmail, type CourseEmailData } from "@/lib/course-email";
import { appUrl, sendMailDetailed } from "@/lib/mail";
import { unsubscribeUrl } from "@/lib/unsubscribe";
import { inviteWhatsAppEnabled, sendWhatsAppInvite } from "@/lib/whatsapp";

/**
 * Students a course has not reached: no entitlement to it at all. A student who bought it and let it lapse is not
 * "unregistered", so they are left out.
 */
export const notInvitedWhere = (courseId: string) => ({ role: "STUDENT" as const, deletedAt: null, entitlements: { none: { courseId } } });

const prefix = (courseId: string) => `invite:${courseId}:`;

/** Students who have no invite notice for this course yet; a second run continues where the first stopped. */
const toNotice = (courseId: string) => ({ ...notInvitedWhere(courseId), notifications: { none: { dedupeKey: { startsWith: prefix(courseId) } } } });

/** People who still take optional mail and have an address. */
const mailable = { email: { not: null }, emailOptOutAt: null, deletedAt: null };

/**
 * Who may get a WhatsApp invite: a number a WhatsApp code or link already reached (so it is on WhatsApp), in international
 * form, not opted out of optional messages, and not under 13 (those accounts belong to their guardian).
 */
const whatsappable = (now = new Date()) => ({
  phone: { startsWith: "+" },
  phoneVerifiedAt: { not: null },
  emailOptOutAt: null,
  deletedAt: null,
  OR: [{ dateOfBirth: null }, { dateOfBirth: { lte: new Date(Date.UTC(now.getUTCFullYear() - MINOR_AGE, now.getUTCMonth(), now.getUTCDate())) } }],
});

/** Pauses between sends: the mail provider takes a couple of requests a second, WhatsApp more. */
const GAP_MS = 600;
const WA_GAP_MS = 250;
/** Stop the WhatsApp pass after this many refusals in a row (an unapproved template would fail every message). */
const WA_STOP_AFTER = 3;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type InviteCopy = { titleAr: string; titleEn: string; bodyAr: string; bodyEn: string };
export type InviteResult = {
  notices: number;
  sent: number;
  failed: number;
  /** WhatsApp messages accepted, refused, and Meta's error code for the first refusal (null if none). */
  waSent: number;
  waFailed: number;
  waError: number | null;
  /** Students still to get a notice, plus the larger of the emails and WhatsApp messages still waiting. */
  left: number;
};

/**
 * One invite email in the reader's language: the subject is the invite title, the body is a short note above a copy of
 * the course page (see course-email.ts), and the unsubscribe link optional mail must carry stays at the bottom.
 */
function deliver(
  to: string,
  ar: boolean,
  userId: string,
  n: { titleAr: string; titleEn: string; bodyAr: string | null; bodyEn: string | null },
  page: CourseEmailData,
  subjectPrefix = "",
) {
  const unsubscribe = unsubscribeUrl(appUrl(), userId);
  return sendMailDetailed({
    to,
    subject: subjectPrefix + pick(ar, n.titleAr, n.titleEn),
    html: renderCourseEmail(page, ar ? "ar" : "en", { intro: pick(ar, n.bodyAr, n.bodyEn) ?? undefined, unsubscribe }),
    unsubscribe,
  });
}

const errorCode = (detail: string) => Number(/"code"\s*:\s*(\d+)/.exec(detail)?.[1]) || null;

/**
 * Sends the exact invite to the signed-in admin only, by email and (if set up) WhatsApp, so they can see what a student
 * receives. Nothing is stored. WhatsApp is "off" when the invite template is not configured.
 */
export async function sendInviteTest(courseId: string, copy: InviteCopy, userId: string): Promise<{ email: boolean; whatsapp: "ok" | "fail" | "off" }> {
  const [course, me] = await Promise.all([
    db.course.findUnique({ where: { id: courseId }, select: { slug: true, titleAr: true, titleEn: true } }),
    db.user.findUnique({ where: { id: userId }, select: { email: true, phone: true, locale: true } }),
  ]);
  const page = await loadCourseEmailData(courseId);
  if (!course || !me || !page) return { email: false, whatsapp: "fail" };
  const ar = me.locale === "ar";
  const email = me.email ? (await deliver(me.email, ar, userId, copy, page, "[Test] ")).ok : false;
  let whatsapp: "ok" | "fail" | "off" = "off";
  if (inviteWhatsAppEnabled()) {
    const r = me.phone?.startsWith("+") ? await sendWhatsAppInvite(me.phone, pick(ar, course.titleAr, course.titleEn), course.slug, ar ? "ar" : "en") : { ok: false };
    whatsapp = r.ok ? "ok" : "fail";
  }
  return { email, whatsapp };
}

/** What has happened so far for this course: notices created, emails and WhatsApp messages delivered, and still waiting. */
export async function inviteStatus(courseId: string) {
  const where = { dedupeKey: { startsWith: prefix(courseId) } };
  const [notified, emailed, waiting, whatsapped, waWaiting] = await Promise.all([
    db.notification.count({ where }),
    db.notification.count({ where: { ...where, emailedAt: { not: null } } }),
    db.notification.count({ where: { ...where, emailedAt: null, user: mailable } }),
    db.notification.count({ where: { ...where, whatsappAt: { not: null } } }),
    db.notification.count({ where: { ...where, whatsappAt: null, user: whatsappable() } }),
  ]);
  return { notified, emailed, waiting, whatsapped, waWaiting };
}

/** `students`: unregistered students; `mailable`: with an address and still taking optional mail; `whatsappable`: reachable on WhatsApp. */
export async function inviteCounts(courseId: string) {
  const [students, mail, whatsapp] = await Promise.all([
    db.user.count({ where: notInvitedWhere(courseId) }),
    db.user.count({ where: { ...notInvitedWhere(courseId), ...mailable } }),
    db.user.count({ where: { ...notInvitedWhere(courseId), ...whatsappable() } }),
  ]);
  return { students, mailable: mail, whatsappable: whatsapp };
}

/**
 * Sends one batch of the course invite: an in-app notice to each unregistered student who has none yet, then the email
 * for every notice not yet mailed, then (only when asked) the WhatsApp message for every notice not yet sent there.
 * Each run is capped at `limit` per channel, so the owner presses again until `left` is 0.
 * Safe to repeat: a student gets one notice per course, and a mailed or messaged notice is never sent again.
 */
export async function inviteStudents(courseId: string, copy: InviteCopy, opts: { limit?: number; whatsapp?: boolean } = {}): Promise<InviteResult> {
  const limit = opts.limit ?? 150;
  const course = await db.course.findUnique({ where: { id: courseId }, select: { slug: true, published: true, titleAr: true, titleEn: true } });
  if (!course?.published) throw new Error("course is not published");

  const students = await db.user.findMany({ where: toNotice(courseId), select: { id: true }, orderBy: { id: "asc" }, take: limit });
  if (students.length) {
    await db.notification.createMany({
      data: students.map((s) => ({
        userId: s.id,
        kind: "NEW_COURSE" as const,
        titleAr: copy.titleAr,
        titleEn: copy.titleEn,
        bodyAr: copy.bodyAr,
        bodyEn: copy.bodyEn,
        href: `/courses/${course.slug}`,
        dedupeKey: `${prefix(courseId)}${s.id}`,
      })),
      skipDuplicates: true,
    });
  }

  // Only people with an address who still take optional mail; a failed send stays unmailed and is retried next run.
  // The course page copy is built once for the batch; each recipient only differs by language and unsubscribe link.
  const page = await loadCourseEmailData(courseId);
  if (!page) throw new Error("course is not published");
  const pending = await db.notification.findMany({
    where: { dedupeKey: { startsWith: prefix(courseId) }, emailedAt: null, user: mailable },
    select: {
      id: true,
      titleAr: true,
      titleEn: true,
      bodyAr: true,
      bodyEn: true,
      userId: true,
      user: { select: { email: true, locale: true } },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let sent = 0;
  let failed = 0;
  for (const n of pending) {
    const r = await deliver(n.user.email!, n.user.locale === "ar", n.userId, n, page);
    if (r.ok) {
      await db.notification.update({ where: { id: n.id }, data: { emailedAt: new Date() } });
      sent += 1;
    } else {
      failed += 1;
    }
    await sleep(GAP_MS);
  }

  let waSent = 0;
  let waFailed = 0;
  let waError: number | null = null;
  if (opts.whatsapp && inviteWhatsAppEnabled()) {
    const queue = await db.notification.findMany({
      where: { dedupeKey: { startsWith: prefix(courseId) }, whatsappAt: null, user: whatsappable() },
      select: { id: true, user: { select: { phone: true, locale: true } } },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    let inRow = 0;
    for (const n of queue) {
      const ar = n.user.locale === "ar";
      const r = await sendWhatsAppInvite(n.user.phone!, pick(ar, course.titleAr, course.titleEn), course.slug, ar ? "ar" : "en");
      if (r.ok) {
        await db.notification.update({ where: { id: n.id }, data: { whatsappAt: new Date() } });
        waSent += 1;
        inRow = 0;
      } else {
        waFailed += 1;
        waError ??= errorCode(r.detail);
        if (++inRow >= WA_STOP_AFTER) break;
      }
      await sleep(WA_GAP_MS);
    }
  }

  const [toGo, status] = await Promise.all([db.user.count({ where: toNotice(courseId) }), inviteStatus(courseId)]);
  const left = toGo + Math.max(status.waiting, opts.whatsapp ? status.waWaiting : 0);
  return { notices: students.length, sent, failed, waSent, waFailed, waError, left };
}
