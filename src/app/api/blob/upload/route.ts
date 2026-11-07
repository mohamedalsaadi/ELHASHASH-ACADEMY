import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { auth } from "@/auth";
import { grantsFor } from "@/lib/catalog";
import { opensAssignment } from "@/lib/assignments";
import {
  ALLOWED_CONTENT_TYPES,
  COVER_CONTENT_TYPES,
  MAX_FILE_BYTES,
  MAX_IMAGE_BYTES,
  avatarPrefix,
  coverPrefix,
  homeworkPrefix,
  submissionPrefix,
} from "@/lib/blob";
import { db } from "@/lib/db";
import { isLimited } from "@/lib/rate-limit";
import { isCourseStaffDb } from "@/lib/staff";

const Purpose = z.union([
  z.object({ purpose: z.literal("assignment"), courseId: z.string().min(1) }),
  z.object({ purpose: z.literal("submission"), assignmentId: z.string().min(1) }),
  z.object({ purpose: z.literal("cover"), courseId: z.string().min(1) }),
  z.object({ purpose: z.literal("avatar"), userId: z.string().min(1) }),
]);

/** Mints a short-lived token so the browser can upload straight to Blob. Never receives file bytes. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = await auth();
        if (!session?.user) throw new Error("Sign in first");
        const me = { id: session.user.id, role: session.user.role };
        // Each token allows a 20 MB file: without a cap one account can fill the store.
        if (await isLimited(`upload:${me.id}`, 50, 86_400_000)) throw new Error("Too many uploads today");
        const payload = Purpose.parse(JSON.parse(clientPayload ?? "{}"));

        let allowedContentTypes = ALLOWED_CONTENT_TYPES;
        let maximumSizeInBytes = MAX_FILE_BYTES;

        if (payload.purpose === "assignment") {
          // Read the role from the database: the cookie outlives a demotion.
          if (!(await isCourseStaffDb(session.user.id, payload.courseId))) throw new Error("Not your course");
          if (!pathname.startsWith(homeworkPrefix(payload.courseId))) throw new Error("Unexpected path");
        } else if (payload.purpose === "submission") {
          const assignment = await db.assignment.findUnique({
            where: { id: payload.assignmentId },
            select: { id: true, courseId: true, lesson: { select: { id: true, month: true, unit: { select: { term: true, isFree: true } } } } },
          });
          if (!assignment) throw new Error("No such assignment");
          const grants = await grantsFor(me.id, assignment.courseId);
          if (!opensAssignment(assignment, grants, new Date())) throw new Error("This assignment is not open to you");
          if (!pathname.startsWith(submissionPrefix(assignment.id, me.id))) throw new Error("Unexpected path");
        } else if (payload.purpose === "cover") {
          if (!(await isCourseStaffDb(session.user.id, payload.courseId))) throw new Error("Not your course");
          if (!pathname.startsWith(coverPrefix(payload.courseId))) throw new Error("Unexpected path");
          allowedContentTypes = COVER_CONTENT_TYPES;
          maximumSizeInBytes = MAX_IMAGE_BYTES;
        } else {
          if (session.user.id !== payload.userId) throw new Error("Not your profile");
          if (!pathname.startsWith(avatarPrefix(payload.userId))) throw new Error("Unexpected path");
          allowedContentTypes = COVER_CONTENT_TYPES;
          maximumSizeInBytes = MAX_IMAGE_BYTES;
        }

        return { allowedContentTypes, maximumSizeInBytes, addRandomSuffix: true };
      },
    });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Upload refused" }, { status: 400 });
  }
}
