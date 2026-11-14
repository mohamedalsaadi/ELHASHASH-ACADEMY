import { auth } from "@/auth";
import { hasPlan, opensAssignment } from "@/lib/assignments";
import { grantsFor, learnerFor, lessonScope } from "@/lib/catalog";
import { streamBlob } from "@/lib/blob";
import { db } from "@/lib/db";
import { opensLesson } from "@/lib/plans";
import { blockerFor } from "@/lib/gate-data";
import { isCourseStaffDb } from "@/lib/staff";

export const dynamic = "force-dynamic";

/**
 * One page of a question's picture or PDF. The teachers of the course always get it; a student gets it when they may open the
 * question's lesson, when the question is on a published exam and they hold a running plan (or already have an attempt on that paper), or
 * when it is on an assignment they may open. A one-lesson rental is not enough for whole-course exam content. Never cached, never a download.
 */
export async function GET(_: Request, { params }: { params: Promise<{ itemId: string; n: string }> }) {
  const { itemId, n } = await params;
  const session = await auth();
  if (!session?.user) return new Response(null, { status: 404 });
  const item = await db.questionItem.findUnique({
    where: { id: itemId },
    include: { lesson: { include: { unit: true } }, examItems: { select: { paperId: true, paper: { select: { published: true } } } }, assignmentItems: { select: { assignment: { select: { courseId: true, lesson: { select: { id: true, month: true, unit: { select: { term: true, isFree: true } } } } } } } } },
  });
  const path = item?.media[Number(n)];
  if (!item || !path) return new Response(null, { status: 404 });

  const courseId = item.courseId;
  const now = new Date();
  let allowed = !!item.lesson?.unit.isFree || (await isCourseStaffDb(session.user.id, courseId));
  if (!allowed) {
    const learnerId = await learnerFor(session.user, courseId, now);
    const grants = await grantsFor(learnerId, courseId, now);
    // A lesson-linked question opens with its lesson.
    const lessonOpen = item.lesson ? grants.some((g) => opensLesson(g, lessonScope(item.lesson!), now)) && !(learnerId && (await blockerFor(learnerId, courseId, item.lesson.id, now))) : false;
    // Exam content needs a running plan, or an attempt the learner already made (their own result page outlives the plan).
    const onExam = item.examItems.length > 0;
    let examOpen = onExam && item.examItems.some((e) => e.paper.published) && hasPlan(grants, now);
    if (onExam && !examOpen) {
      const who = [session.user.id, ...(learnerId && learnerId !== session.user.id ? [learnerId] : [])];
      examOpen = (await db.examAttempt.findFirst({ where: { userId: { in: who }, paperId: { in: item.examItems.map((e) => e.paperId) } }, select: { id: true } })) !== null;
    }
    const assignmentOpen = item.assignmentItems.some((a) => opensAssignment(a.assignment, grants, now));
    allowed = lessonOpen || examOpen || assignmentOpen;
  }
  if (!allowed) return new Response(null, { status: 404 });
  return streamBlob(path, "image/jpeg", "private, no-store");
}
