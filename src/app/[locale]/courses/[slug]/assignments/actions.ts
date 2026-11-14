"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
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

  if (existing) {
    // Returning the work is the instructor asking for a redo, so it always reopens once. The switch only
    // covers the other case: resubmitting after a grade the teacher did not ask to see again.
    const canRedo = existing.status === "RETURNED" || (assignment.allowResubmit && existing.status === "GRADED");
    if (!canRedo) return "already";
  }

  // Check every file against Blob before writing anything, so a failed head check leaves no half-saved row.
  // React resets the form after the action, so the "filesLost" message asks the student to attach them again.
  const stored = await verifiedFiles(assignment.id, studentId, files);
  if (stored.length < files.length) return "filesLost";

  // The submission, its files and its answers go in together: a failure part-way leaves the student able to retry.
  // Questions set on this assignment are marked here from the database, never from the client. A quiz with nothing for
  // a teacher to read is graded on the spot below; otherwise it waits, with the questions' marks as the suggested score.
  const marked = items.length > 0 ? markExam(items, replies) : null;
  let submissionId: string;
  try {
    submissionId = await db.$transaction(async (tx) => {
      let id: string;
      if (existing) {
        await tx.submissionFile.deleteMany({ where: { submissionId: existing.id } });
        await tx.submission.update({
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
        });
        id = existing.id;
      } else {
        id = (await tx.submission.create({ data: { assignmentId: assignment.id, studentId, text, submittedAt: now, status: "SUBMITTED" } })).id;
      }
      if (stored.length > 0) await tx.submissionFile.createMany({ data: stored.map((f) => ({ submissionId: id, ...f })) });
      if (marked) {
        await tx.submissionAnswer.deleteMany({ where: { submissionId: id } });
        await tx.submissionAnswer.createMany({
          data: marked.results.map((r) => {
            const reply = replies.find((x) => x.itemId === r.itemId);
            const item = items.find((i) => i.id === r.itemId)!;
            const choice = item.kind === "MCQ" || item.kind === "MULTI";
            return {
              submissionId: id,
              itemId: r.itemId,
              correct: r.correct,
              marks: r.marks,
              choiceId: item.kind === "MCQ" ? reply?.choiceId ?? null : null,
              choiceIds: choice ? reply?.choiceIds ?? [] : [],
              text: item.kind === "SHORT" || item.kind === "WRITTEN" ? reply?.text ?? null : null,
            };
          }),
        });
      }
      return id;
    });
  } catch (e) {
    // A double tap: the other request created the row first.
    if (!existing && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "already";
    throw e;
  }

  if (marked && !marked.needsGrading && !text && files.length === 0) {
    const maxScore = (await db.assignment.findUniqueOrThrow({ where: { id: assignment.id }, select: { maxScore: true } })).maxScore;
    await db.submission.update({
      where: { id: submissionId },
      data: { status: "GRADED", score: scaleScore(marked.autoMarks, marked.maxMarks, maxScore), gradedAt: now, gradedById: null },
    });
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
  revalidatePath("/[locale]/courses/[slug]", "page");
  return masked ? "masked" : "ok";
}

/** Only blobs under this student's prefix, with the size Blob reports rather than the client's. A file that fails the check is left out. */
async function verifiedFiles(assignmentId: string, studentId: string, files: { pathname: string; downloadName: string }[]) {
  const prefix = submissionPrefix(assignmentId, studentId);
  const out: { pathname: string; downloadName: string; contentType: string; size: number }[] = [];
  for (const f of files) {
    if (!f.pathname.startsWith(prefix)) continue;
    const info = await blobInfo(f.pathname);
    if (!info || info.size > MAX_FILE_BYTES) continue;
    out.push({ pathname: f.pathname, downloadName: f.downloadName, contentType: info.contentType, size: info.size });
  }
  return out;
}

export type FinishState = "closed" | "notOpened" | "ok" | null;

/**
 * "I finished": a student says they did a quiz that lives on Google Forms. It is only accepted after they opened the form through
 * the site, and it hands the work in (a submission with no text), which is what opens the lessons after it. The teacher's upload of
 * the form's responses later shows who said so without answering, and saves the real scores onto the same row.
 */
export async function confirmFinished(_prev: FinishState, form: FormData): Promise<FinishState> {
  const session = await auth();
  if (!session?.user) notFound();
  const studentId = session.user.id;
  const id = z.string().min(1).parse(form.get("assignmentId"));

  const a = await db.assignment.findUnique({
    where: { id },
    select: { id: true, courseId: true, linkUrl: true, kind: true, lesson: { select: { id: true, month: true, unit: { select: { term: true, isFree: true } } } } },
  });
  if (!a || a.kind !== "QUIZ" || !a.linkUrl) notFound();

  const now = new Date();
  if (!opensAssignment(a, await grantsFor(studentId, a.courseId, now), now)) return "closed";
  const opened = await db.analyticsEvent.findFirst({ where: { name: "external_quiz_open", userId: studentId, props: { path: ["assignmentId"], equals: a.id } }, select: { id: true } });
  if (!opened) return "notOpened";

  await db.submission.upsert({
    where: { assignmentId_studentId: { assignmentId: a.id, studentId } },
    create: { assignmentId: a.id, studentId, status: "SUBMITTED" },
    update: {},
  });
  revalidatePath("/[locale]/courses/[slug]/assignments/[assignmentId]", "page");
  revalidatePath("/[locale]/courses/[slug]/assignments", "page");
  revalidatePath("/[locale]/courses/[slug]", "page");
  revalidatePath("/[locale]/teacher/assignments/[id]", "page");
  return "ok";
}
