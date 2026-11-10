"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { suggestGrade, suggestSubmissionAnswers } from "@/lib/ai-grading";
import { markExam, scaleScore } from "@/lib/exams";
import { replyFrom } from "@/lib/practice";
import { hasGuardianConsent } from "@/lib/live";
import { opensAssignment } from "@/lib/assignments";
import { MAX_FILE_BYTES, MAX_FILES, blobInfo, submissionPrefix } from "@/lib/blob";
import { grantsFor } from "@/lib/catalog";
import { maskContacts } from "@/lib/contact-guard";
import { db } from "@/lib/db";
import { isLimited, recordAttempt } from "@/lib/rate-limit";

export type SubmitError = "invalid" | "closed" | "already" | "limited" | "ok" | "masked" | "filesLost" | null;

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

  // Questions set on this assignment (a quiz, or homework with questions): marked here from the database, never from the client.
  const items = (
    await db.assignmentItem.findMany({
      where: { assignmentId: assignment.id },
      orderBy: { order: "asc" },
      select: { item: { select: { id: true, kind: true, marks: true, answer: true, choices: { select: { id: true, correct: true } } } } },
    })
  ).map((i) => i.item);
  const replies = items.map((item) => replyFrom(form, item.id));
  const answered = replies.some((r) => r.choiceIds?.length || r.text);
  if (!text && files.length === 0 && !answered) return "invalid";

  const existing = await db.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId: assignment.id, studentId } },
    select: { id: true, status: true, revision: true },
  });

  let submissionId: string;
  let kept = 0;
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
    kept = await saveFiles(existing.id, assignment.id, studentId, files);
    submissionId = existing.id;
  } else {
    const created = await db.submission.create({
      data: { assignmentId: assignment.id, studentId, text, submittedAt: now, status: "SUBMITTED" },
    });
    kept = await saveFiles(created.id, assignment.id, studentId, files);
    submissionId = created.id;
  }

  // Store the answers and mark what can be marked. A quiz with nothing for a teacher to read is graded on the spot;
  // otherwise it waits, with the questions' marks as the suggested score.
  if (items.length > 0) {
    const marked = markExam(items, replies);
    await db.$transaction([
      db.submissionAnswer.deleteMany({ where: { submissionId } }),
      db.submissionAnswer.createMany({
        data: marked.results.map((r) => {
          const reply = replies.find((x) => x.itemId === r.itemId);
          const item = items.find((i) => i.id === r.itemId)!;
          const choice = item.kind === "MCQ" || item.kind === "MULTI";
          return {
            submissionId,
            itemId: r.itemId,
            correct: r.correct,
            marks: r.marks,
            choiceId: item.kind === "MCQ" ? reply?.choiceId ?? null : null,
            choiceIds: choice ? reply?.choiceIds ?? [] : [],
            text: item.kind === "SHORT" || item.kind === "WRITTEN" ? reply?.text ?? null : null,
          };
        }),
      }),
    ]);
    if (!marked.needsGrading && !text && files.length === 0) {
      const maxScore = (await db.assignment.findUniqueOrThrow({ where: { id: assignment.id }, select: { maxScore: true } })).maxScore;
      await db.submission.update({
        where: { id: submissionId },
        data: { status: "GRADED", score: scaleScore(marked.autoMarks, marked.maxMarks, maxScore), gradedAt: now, gradedById: null },
      });
    }
  }

  await recordAttempt(`submit:${studentId}`);
  // A first mark is waiting when the teacher opens it — only for a course that opted in, because
  // the submission (and any photo of handwritten work) leaves our servers for an AI provider.
  // A guardian must have consented: every STUDENT is treated as a minor. Capped per course too.
  if (assignment.course.aiGrading && (await hasGuardianConsent(studentId))) {
    after(async () => {
      const key = `ai-auto:${assignment.courseId}`;
      if (await isLimited(key, 300, 86_400_000)) return;
      if ((text || files.length > 0) && (await suggestGrade(submissionId).catch(() => false))) await recordAttempt(key);
      if (items.some((i) => i.kind === "WRITTEN") && (await suggestSubmissionAnswers(submissionId).catch(() => 0)) > 0) await recordAttempt(key);
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
  // The work is in, but a file that could not be stored must not look like it arrived.
  if (kept < files.length) return "filesLost";
  return masked ? "masked" : "ok";
}

/** Only blobs under this student's prefix, with the size Blob reports rather than the client's. */
async function saveFiles(submissionId: string, assignmentId: string, studentId: string, files: { pathname: string; downloadName: string }[]) {
  const prefix = submissionPrefix(assignmentId, studentId);
  let kept = 0;
  for (const f of files) {
    if (!f.pathname.startsWith(prefix)) continue;
    const info = await blobInfo(f.pathname);
    if (!info || info.size > MAX_FILE_BYTES) continue;
    kept += 1;
    await db.submissionFile.create({
      data: { submissionId, pathname: f.pathname, downloadName: f.downloadName, contentType: info.contentType, size: info.size },
    });
  }
  return kept;
}
