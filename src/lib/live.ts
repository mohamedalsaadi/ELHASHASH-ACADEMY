import { isMinor } from "@/lib/age";
import { db } from "@/lib/db";

/**
 * Live streaming is off unless an admin approved that teacher. Everything that offers live —
 * course pages, checkout, the join page, teacher tools — routes its decision through here, so
 * turning one teacher on does not leave a surface behind that still advertises live.
 */
export async function liveApprovedFor(instructorId: string): Promise<boolean> {
  const teacher = await db.user.findUnique({ where: { id: instructorId }, select: { liveApproved: true } });
  return teacher?.liveApproved ?? false;
}

/**
 * The same decision for a course, read through the relation so a page can include it in one query
 * instead of asking per course.
 */
export function liveApprovedOn(course: { instructor?: { liveApproved: boolean } | null } | null | undefined): boolean {
  return course?.instructor?.liveApproved ?? false;
}

/** The instructor half of every "may this teacher run live" filter, so a caller can merge it into
 *  its own `course` condition instead of overwriting it. */
export const liveInstructor = { instructor: { liveApproved: true } } as const;

/**
 * One Prisma filter for every listing surface that offers live, so a fifth surface cannot invent
 * its own spelling of "this teacher may run live".
 */
export const liveOffered = { cancelledAt: null, course: liveInstructor } as const;

/** Admins always may publish; a teacher only once an admin turned live on for them. */
export async function canPublishLive(me: { id: string; role: string }): Promise<boolean> {
  return me.role === "ADMIN" || (await liveApprovedFor(me.id));
}

/**
 * A guardian must have verified consent before a minor joins live or uses AI grading. An adult
 * needs no guardian row; a legacy account with no birth date is grandfathered by the migration.
 */
export async function hasGuardianConsent(studentId: string): Promise<boolean> {
  const student = await db.user.findUnique({
    where: { id: studentId },
    select: { dateOfBirth: true, guardianConsent: { select: { verifiedAt: true } } },
  });
  if (!student) return false;
  // No birth date is a legacy account. The old rule treated every student as a minor, so keep that
  // for live and AI; the migration marks the consent rows that already existed as verified.
  const minor = student.dateOfBirth === null ? true : isMinor(student.dateOfBirth);
  if (!minor) return true;
  return Boolean(student.guardianConsent?.verifiedAt);
}
