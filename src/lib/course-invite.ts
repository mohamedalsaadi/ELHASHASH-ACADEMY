import { pick } from "@/lib/content";
import { db } from "@/lib/db";
import { appUrl, emailLayout, sendMailDetailed } from "@/lib/mail";
import { unsubscribeUrl } from "@/lib/unsubscribe";

/**
 * Students a course has not reached: no entitlement to it at all. A student who bought it and let it lapse is not
 * "unregistered", so they are left out.
 */
export const notInvitedWhere = (courseId: string) => ({ role: "STUDENT" as const, deletedAt: null, entitlements: { none: { courseId } } });

/** Students who have no invite notice for this course yet; a second run continues where the first stopped. */
const toNotice = (courseId: string) => ({ ...notInvitedWhere(courseId), notifications: { none: { dedupeKey: { startsWith: prefix(courseId) } } } });

const prefix = (courseId: string) => `invite:${courseId}:`;

/** Pause between emails: the mail provider takes a couple of requests a second. */
const GAP_MS = 600;

export type InviteCopy = { titleAr: string; titleEn: string; bodyAr: string; bodyEn: string };
export type InviteResult = { notices: number; sent: number; failed: number; left: number };

/** `students`: unregistered students; `mailable`: those with an address who have not opted out of optional mail. */
export async function inviteCounts(courseId: string) {
  const [students, mailable] = await Promise.all([
    db.user.count({ where: notInvitedWhere(courseId) }),
    db.user.count({ where: { ...notInvitedWhere(courseId), email: { not: null }, emailOptOutAt: null } }),
  ]);
  return { students, mailable };
}

/**
 * Sends one batch of the course invite: an in-app notice to each unregistered student who has none yet, then the email
 * for every notice not yet mailed. Each run is capped at `limit`, so the owner presses again until `left` is 0.
 * Safe to repeat: a student gets one notice per course, and a mailed notice is never mailed again.
 */
export async function inviteStudents(courseId: string, copy: InviteCopy, limit = 150): Promise<InviteResult> {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { slug: true, published: true } });
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
  const pending = await db.notification.findMany({
    where: {
      dedupeKey: { startsWith: prefix(courseId) },
      emailedAt: null,
      user: { email: { not: null }, emailOptOutAt: null, deletedAt: null },
    },
    select: {
      id: true,
      titleAr: true,
      titleEn: true,
      bodyAr: true,
      bodyEn: true,
      href: true,
      userId: true,
      user: { select: { email: true, locale: true } },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let sent = 0;
  let failed = 0;
  for (const n of pending) {
    const ar = n.user.locale === "ar";
    const title = pick(ar, n.titleAr, n.titleEn);
    const body = pick(ar, n.bodyAr, n.bodyEn) ?? null;
    const unsubscribe = unsubscribeUrl(appUrl(), n.userId);
    const cta = n.href ? { href: `${appUrl()}${n.href}`, label: ar ? "افتح ذروة" : "Open Dhirwa" } : undefined;
    const r = await sendMailDetailed({
      to: n.user.email!,
      subject: title,
      html: emailLayout(title, body ? [body] : [], cta, ar ? "ar" : "en", unsubscribe),
      unsubscribe,
    });
    if (r.ok) {
      await db.notification.update({ where: { id: n.id }, data: { emailedAt: new Date() } });
      sent += 1;
    } else {
      failed += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, GAP_MS));
  }

  const left = await db.user.count({ where: toNotice(courseId) });
  return { notices: students.length, sent, failed, left };
}
