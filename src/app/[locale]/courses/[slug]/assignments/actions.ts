"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { suggestGrade } from "@/lib/ai-grading";
import { opensAssignment } from "@/lib/assignments";
import { MAX_FILE_BYTES, MAX_FILES, blobInfo, submissionPrefix } from "@/lib/blob";
import { grantsFor } from "@/lib/catalog";
import { maskContacts } from "@/lib/contact-guard";
import { db } from "@/lib/db";
import { isLimited, recordAttempt } from "@/lib/rate-limit";

export type SubmitError = "invalid" | "closed" | "already" | "limited" | "ok" | "masked" | null;

const uploaded = z.array(z.object({ pathname: z.string().min(1), downloadName: z.string().min(1).max(255) }));

function fileList(raw: FormDataEntryValue | null) {
  try {
    const parsed = uploaded.safeParse(JSON.parse(String(raw ?? "[]")));
    return parsed.success ? parsed.data.slice(0, MAX_FILES) : [];
  } catch {
    return [];
  }
}

/**
 * A student hands in one assignment. One row per (assignment, student): a resubmission updates it in place,
 * bumps the revision and clears the old grade, but only when the teacher allowed it and the work came back.
 */
export async function submitAssignment(_prev: SubmitError, form: FormData): Promise<SubmitError> {
  const session = await auth();
  if (!session?.user) notFound();
  const studentId = session.user.id;

  const parsed = z
    .object({
      assignmentId: z.string().min(1),
      text: z.string().trim().max(10000).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return "invalid";

  const assignment = await db.assignment.findUnique({
    where: { id: parsed.data.assignmentId },
    select: {
      id: true,
      courseId: true,
      title: true,
      allowResubmit: true,
      lesson: { select: { id: true, month: true, unit: { select: { term: true, isFree: true } } } },
      course: { select: { slug: true, instructorId: true, aiGrading: true } },
    },
  });
  if (!assignment) notFound();

  const now = new Date();
  const grants = await grantsFor(studentId, assignment.courseId, now);
  if (!opensAssignment(assignment, grants, now)) return "closed";

  if (await isLimited(`submit:${studentId}`, 20, 86_400_000)) return "limited";

  const files = fileList(form.get("files"));
  const text = parsed.data.text?.trim() ? maskContacts(parsed.data.text).text : null;
  const masked = parsed.data.text ? maskContacts(parsed.data.text).masked : false;
  if (!text && files.length === 0) return "invalid";

  const existing = await db.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId: assignment.id, studentId } },
    select: { id: true, status: true, revision: true },
  });

  let submissionId: string;
  if (existing) {
    // Returning the work is the instructor asking for a redo, so it always reopens once. The switch only
    // covers the other case: resubmitting after a grade the teacher did not ask to see again.
    const canRedo = existing.status === "RETURNED" || (assignment.allowResubmit && existing.status === "GRADED");
    if (!canRedo) return "already";
    await db.$transaction([
      db.submissionFile.deleteMany({ where: { submissionId: existing.id } }),
      db.submission.update({
        where: { id: existing.id },
        data: {
          status: "SUBMITTED",
          text,
          submittedAt: now,
          revision: existing.revision + 1,
          score: null,
          feedback: null,
          gradedAt: null,
          gradedById: null,
          aiScore: null,
          aiFeedback: null,
        },
      }),
    ]);
    await saveFiles(existing.id, assignment.id, studentId, files);
    submissionId = existing.id;
  } else {
    const created = await db.submission.create({
      data: { assignmentId: assignment.id, studentId, text, submittedAt: now, status: "SUBMITTED" },
    });
    await saveFiles(created.id, assignment.id, studentId, files);
    submissionId = created.id;
  }

  await recordAttempt(`submit:${studentId}`);
  // A first mark is waiting when the teacher opens it — only for a course that opted in, because
  // the submission (and any photo of handwritten work) leaves our servers for an AI provider.
  // Capped per course so one class cannot run up the bill.
  if (assignment.course.aiGrading) {
    after(async () => {
      const key = `ai-auto:${assignment.courseId}`;
      if (await isLimited(key, 300, 86_400_000)) return;
      if (await suggestGrade(submissionId).catch(() => false)) await recordAttempt(key);
    });
  }
  await db.notification
    .create({
      data: {
        userId: assignment.course.instructorId,
        kind: "SUBMISSION_RECEIVED",
        titleAr: `تسليم جديد: ${assignment.title}`,
        titleEn: `New submission: ${assignment.title}`,
        href: `/teacher/assignments/${assignment.id}`,
        dedupeKey: `sub-recv:${assignment.id}:${studentId}:${existing ? existing.revision + 1 : 1}`,
      },
    })
    .catch(() => null);

  revalidatePath("/[locale]/courses/[slug]/assignments/[assignmentId]", "page");
  revalidatePath("/[locale]/dashboard", "page");
  revalidatePath("/[locale]/teacher/assignments/[id]", "page");
  return masked ? "masked" : "ok";
}

/** Only blobs under this student's prefix, with the size Blob reports rather than the client's. */
async function saveFiles(submissionId: string, assignmentId: string, studentId: string, files: { pathname: string; downloadName: string }[]) {
  const prefix = submissionPrefix(assignmentId, studentId);
  for (const f of files) {
    if (!f.pathname.startsWith(prefix)) continue;
    const info = await blobInfo(f.pathname);
    if (!info || info.size > MAX_FILE_BYTES) continue;
    await db.submissionFile.create({
      data: { submissionId, pathname: f.pathname, downloadName: f.downloadName, contentType: info.contentType, size: info.size },
    });
  }
}
