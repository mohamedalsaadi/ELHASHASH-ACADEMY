import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { auth } from "@/auth";
import { grantsFor, isCourseStaff } from "@/lib/catalog";
import { opensAssignment } from "@/lib/assignments";
import { ALLOWED_CONTENT_TYPES, MAX_FILE_BYTES, homeworkPrefix, submissionPrefix } from "@/lib/blob";
import { db } from "@/lib/db";

const Purpose = z.union([
  z.object({ purpose: z.literal("assignment"), courseId: z.string().min(1) }),
  z.object({ purpose: z.literal("submission"), assignmentId: z.string().min(1) }),
]);

/** Mints a short-lived token so the browser can upload straight to Blob. Never receives file bytes. */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = await auth();
        if (!session?.user) throw new Error("Sign in first");
        const me = { id: session.user.id, role: session.user.role };
        const payload = Purpose.parse(JSON.parse(clientPayload ?? "{}"));

        if (payload.purpose === "assignment") {
          const course = await db.course.findUnique({ where: { id: payload.courseId }, select: { id: true, instructorId: true } });
          if (!course || !isCourseStaff(me, course)) throw new Error("Not your course");
          if (!pathname.startsWith(homeworkPrefix(course.id))) throw new Error("Unexpected path");
        } else {
          const assignment = await db.assignment.findUnique({
            where: { id: payload.assignmentId },
            select: { id: true, courseId: true, lesson: { select: { id: true, month: true, unit: { select: { term: true, isFree: true } } } } },
          });
          if (!assignment) throw new Error("No such assignment");
          const grants = await grantsFor(me.id, assignment.courseId);
          if (!opensAssignment(assignment, grants, new Date())) throw new Error("This assignment is not open to you");
          if (!pathname.startsWith(submissionPrefix(assignment.id, me.id))) throw new Error("Unexpected path");
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Upload refused" }, { status: 400 });
  }
}
