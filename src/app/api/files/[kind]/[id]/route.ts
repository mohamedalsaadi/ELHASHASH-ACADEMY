import { get } from "@vercel/blob";
import { auth } from "@/auth";
import { opensAssignment } from "@/lib/assignments";
import { contentDisposition } from "@/lib/blob";
import { grantsFor } from "@/lib/catalog";
import { db } from "@/lib/db";
import { isCourseStaffDb } from "@/lib/staff";

const notFound = () => new Response(null, { status: 404 });

/**
 * Streams a private Blob object to someone who is allowed to read it. Authorisation happens here, in the
 * route: /api sits outside the locale middleware, so nothing upstream decides who may read what.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const session = await auth();
  if (!session?.user) return notFound();
  const me = { id: session.user.id, role: session.user.role };
  const now = new Date();

  let pathname: string;
  let downloadName: string;
  let contentType: string;

  if (kind === "assignment") {
    const file = await db.assignmentFile.findUnique({
      where: { id },
      select: {
        pathname: true,
        downloadName: true,
        contentType: true,
        assignment: {
          select: {
            courseId: true,
            lesson: { select: { id: true, month: true, unit: { select: { term: true, isFree: true } } } },
          },
        },
      },
    });
    if (!file) return notFound();
    const { assignment } = file;
    const staff = await isCourseStaffDb(me.id, assignment.courseId);
    const allowed = staff || opensAssignment(assignment, await grantsFor(me.id, assignment.courseId, now), now);
    if (!allowed) return notFound();
    ({ pathname, downloadName, contentType } = file);
  } else if (kind === "submission") {
    const file = await db.submissionFile.findUnique({
      where: { id },
      select: {
        pathname: true,
        downloadName: true,
        contentType: true,
        submission: {
          select: {
            studentId: true,
            assignment: { select: { courseId: true } },
          },
        },
      },
    });
    if (!file) return notFound();
    const { submission } = file;
    const staff = await isCourseStaffDb(me.id, submission.assignment.courseId);
    // A parent may read their own child's work; nobody else may.
    const linkedParent =
      me.role === "PARENT"
        ? (await db.parentLink.findFirst({ where: { parentId: me.id, studentId: submission.studentId }, select: { id: true } })) !== null
        : false;
    if (!(staff || submission.studentId === me.id || linkedParent)) return notFound();
    ({ pathname, downloadName, contentType } = file);
  } else {
    return notFound();
  }

  const blob = await get(pathname, { access: "private" });
  if (!blob || blob.statusCode !== 200) return notFound();

  return new Response(blob.stream, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition(downloadName),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-cache",
    },
  });
}
