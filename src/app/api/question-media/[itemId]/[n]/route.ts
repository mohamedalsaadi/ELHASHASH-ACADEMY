import { auth } from "@/auth";
import { grantsFor, learnerFor, lessonScope } from "@/lib/catalog";
import { streamBlob } from "@/lib/blob";
import { db } from "@/lib/db";
import { opensLesson } from "@/lib/plans";
import { isCourseStaffDb } from "@/lib/staff";

export const dynamic = "force-dynamic";

/**
 * One page of a question's picture or PDF. The teachers of the course always get it; a student gets it when they may open the
 * question's lesson, or when the question is on a published exam of a course they hold. Never cached, never a download.
 */
export async function GET(_: Request, { params }: { params: Promise<{ itemId: string; n: string }> }) {
  const { itemId, n } = await params;
  const session = await auth();
  if (!session?.user) return new Response(null, { status: 404 });
  const item = await db.questionItem.findUnique({
    where: { id: itemId },
    include: { lesson: { include: { unit: true } }, examItems: { where: { paper: { published: true } }, select: { id: true }, take: 1 }, assignmentItems: { select: { id: true }, take: 1 } },
  });
  const path = item?.media[Number(n)];
  if (!item || !path) return new Response(null, { status: 404 });

  const courseId = item.courseId;
  const now = new Date();
  let allowed = !!item.lesson?.unit.isFree || (await isCourseStaffDb(session.user.id, courseId));
  if (!allowed) {
    const learnerId = await learnerFor(session.user, courseId, now);
    const grants = await grantsFor(learnerId, courseId, now);
    // A lesson-linked question opens with its lesson; any question on a published exam or a quiz of the course opens for a subscriber.
    const lessonOpen = item.lesson ? grants.some((g) => opensLesson(g, lessonScope(item.lesson!), now)) : false;
    allowed = lessonOpen || ((item.examItems.length > 0 || item.assignmentItems.length > 0) && grants.length > 0);
  }
  if (!allowed) return new Response(null, { status: 404 });
  return streamBlob(path, "image/jpeg", "private, no-store");
}
