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
