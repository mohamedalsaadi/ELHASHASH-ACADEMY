import { auth } from "@/auth";
import { logEvent } from "@/lib/analytics";
import { opensAssignment } from "@/lib/assignments";
import { grantsFor } from "@/lib/catalog";
import { db } from "@/lib/db";
import { quizUrlFor, studentCode } from "@/lib/external-link";
import { isCourseStaffDb } from "@/lib/staff";

export const dynamic = "force-dynamic";

/**
 * The only way to an assignment's outside link. It checks, on every click, that the person may open the assignment now, so a
 * lapsed plan stops working, and the page never carries the raw address. A subscriber can still copy the address they land on;
 * the code in the link (and the form's own sign-in setting) is what ties an answer to a student.
 */
export async function GET(_: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  const session = await auth();
  if (!session?.user) return new Response(null, { status: 404 });

  const a = await db.assignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, courseId: true, linkUrl: true, lesson: { select: { id: true, month: true, unit: { select: { term: true, isFree: true } } } } },
  });
  if (!a?.linkUrl) return new Response(null, { status: 404 });

  const now = new Date();
  const staff = await isCourseStaffDb(session.user.id, a.courseId);
  if (!staff && !opensAssignment(a, await grantsFor(session.user.id, a.courseId, now), now)) return new Response(null, { status: 404 });

  const target = quizUrlFor(a.linkUrl, staff ? "PREVIEW" : studentCode(session.user.id, a.id));
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return new Response(null, { status: 404 });
  }
  if (url.protocol !== "https:") return new Response(null, { status: 404 });

  if (!staff) await logEvent({ name: "external_quiz_open", userId: session.user.id, courseId: a.courseId, props: { assignmentId: a.id }, dedupeScope: a.id });
  return new Response(null, { status: 302, headers: { Location: url.toString(), "Cache-Control": "no-store" } });
}
