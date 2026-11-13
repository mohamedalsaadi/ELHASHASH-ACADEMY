import { auth } from "@/auth";
import { grantsFor, learnerFor, lessonScope } from "@/lib/catalog";
import { streamBlob } from "@/lib/blob";
import { db } from "@/lib/db";
import { opensLesson } from "@/lib/plans";
import { blockerFor } from "@/lib/gate-data";
import { isCourseStaffDb } from "@/lib/staff";

export const dynamic = "force-dynamic";

/** One page image of a lesson PDF. Only people who may open the lesson get it, and nothing is cached or offered as a download. */
export async function GET(_: Request, { params }: { params: Promise<{ lessonId: string; n: string }> }) {
  const { lessonId, n } = await params;
  const session = await auth();
  if (!session?.user) return new Response(null, { status: 404 });
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, include: { unit: true } });
  const path = lesson?.pdfPages[Number(n)];
  if (!lesson || !path) return new Response(null, { status: 404 });

  const courseId = lesson.unit.courseId;
  const now = new Date();
  const staff = await isCourseStaffDb(session.user.id, courseId);
  let allowed = lesson.unit.isFree || staff;
  const learnerId = await learnerFor(session.user, courseId, now);
  if (!allowed) {
    const scope = lessonScope(lesson);
    allowed = (await grantsFor(learnerId, courseId, now)).some((g) => opensLesson(g, scope, now));
  }
  if (!allowed) return new Response(null, { status: 404 });
  // Closed by mandatory work on an earlier lesson: the pages stay closed too, not only the screen.
  if (!staff && learnerId && (await blockerFor(learnerId, courseId, lesson.id, now))) return new Response(null, { status: 404 });
  return streamBlob(path, "image/jpeg", "private, no-store");
}
