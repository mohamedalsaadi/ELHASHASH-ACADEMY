"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MAX_FILE_BYTES, MAX_FILES, blobInfo, homeworkPrefix } from "@/lib/blob";
import { gradeWithAi as requestAiGrade } from "@/lib/ai-grading";
import { maskContacts } from "@/lib/contact-guard";
import { db } from "@/lib/db";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { assertCourse, requireStaff } from "@/lib/staff";

type Uploaded = { pathname: string; downloadName: string };

const uploaded = z.array(z.object({ pathname: z.string().min(1), downloadName: z.string().min(1).max(255) }));

function fileList(raw: FormDataEntryValue | null): Uploaded[] {
  try {
    const parsed = uploaded.safeParse(JSON.parse(String(raw ?? "[]")));
    return parsed.success ? parsed.data.slice(0, MAX_FILES) : [];
  } catch {
    return [];
  }
}

function dueAt(raw: FormDataEntryValue | null): Date | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Records only blobs that really exist, under this course's prefix, with the size Blob reports. */
async function saveFiles(assignmentId: string, courseId: string, raw: FormDataEntryValue | null) {
  for (const f of fileList(raw)) {
    if (!f.pathname.startsWith(homeworkPrefix(courseId))) continue;
    const info = await blobInfo(f.pathname);
    if (!info || info.size > MAX_FILE_BYTES) continue;
    await db.assignmentFile.create({
      data: { assignmentId, pathname: f.pathname, downloadName: f.downloadName, contentType: info.contentType, size: info.size },
    });
  }
}

const refocus = (slug?: string | null) => {
  revalidatePath("/[locale]/teacher/assignments", "page");
  revalidatePath("/[locale]/dashboard", "page");
  if (slug) revalidatePath("/[locale]/courses/[slug]", "page");
};

/** Form state for the authoring screens: null means "fine", anything else is a message key. */
export type AssignmentError = "invalid" | "lesson" | null;

export async function createAssignment(_prev: AssignmentError, form: FormData): Promise<AssignmentError> {
  const me = await requireStaff();
  const parsed = z
    .object({
      courseId: z.string().min(1),
      lessonId: z.string().optional(),
      title: z.string().trim().min(3).max(200),
      instructions: z.string().trim().max(8000).optional(),
      dueAt: z.string().optional(),
      maxScore: z.coerce.number().int().min(1).max(1000).default(100),
      allowResubmit: z.string().optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return "invalid";
  const d = parsed.data;

  const course = await db.course.findUniqueOrThrow({ where: { id: d.courseId }, select: { slug: true, instructorId: true } });
  await assertCourse(me, d.courseId);

  let lessonId: string | null = null;
  if (d.lessonId) {
    const lesson = await db.lesson.findUnique({ where: { id: d.lessonId }, select: { unit: { select: { courseId: true } } } });
    if (!lesson || lesson.unit.courseId !== d.courseId) return "lesson";
    lessonId = d.lessonId;
  }

  const created = await db.assignment.create({
    data: {
      courseId: d.courseId,
      lessonId,
      createdById: me.id,
      title: d.title,
      instructions: d.instructions || null,
      dueAt: dueAt(form.get("dueAt")),
      maxScore: d.maxScore,
      allowResubmit: d.allowResubmit === "on",
    },
  });
  await saveFiles(created.id, d.courseId, form.get("files"));

  // Everyone holding a live grant for the course gets one in-app notice. No email: this is not urgent.
  const holders = await db.entitlement.findMany({
    where: { courseId: d.courseId, startsAt: { lte: new Date() }, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
    distinct: ["userId"],
    select: { userId: true },
    take: 500,
  });
  if (holders.length > 0) {
    await db.notification.createMany({
      data: holders.map((h) => ({
        userId: h.userId,
        kind: "ASSIGNMENT_NEW" as const,
        titleAr: `واجب جديد: ${d.title}`,
        titleEn: `New homework: ${d.title}`,
        href: `/courses/${course.slug}/assignments/${created.id}`,
        dedupeKey: `assign:${created.id}:${h.userId}`,
      })),
      skipDuplicates: true,
    });
  }

  refocus(course.slug);
  revalidatePath("/[locale]/teacher/assignments/[id]", "page");
  redirect(`/teacher/assignments/${created.id}`);
}

export async function updateAssignment(_prev: AssignmentError, form: FormData): Promise<AssignmentError> {
  const me = await requireStaff();
  const parsed = z
    .object({
      id: z.string().min(1),
      title: z.string().trim().min(3).max(200),
      instructions: z.string().trim().max(8000).optional(),
      dueAt: z.string().optional(),
      maxScore: z.coerce.number().int().min(1).max(1000),
      allowResubmit: z.string().optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return "invalid";
  const d = parsed.data;

  const a = await db.assignment.findUniqueOrThrow({ where: { id: d.id }, select: { courseId: true, course: { select: { slug: true } } } });
  await assertCourse(me, a.courseId);

  await db.assignment.update({
    where: { id: d.id },
    data: {
      title: d.title,
      instructions: d.instructions || null,
      dueAt: dueAt(form.get("dueAt")),
      maxScore: d.maxScore,
      allowResubmit: d.allowResubmit === "on",
    },
  });
  await saveFiles(d.id, a.courseId, form.get("files"));

  refocus(a.course.slug);
  revalidatePath("/[locale]/teacher/assignments/[id]", "page");
  return null;
}

export async function deleteAssignmentFile(form: FormData) {
  const me = await requireStaff();
  const d = z.object({ id: z.string().min(1) }).parse(Object.fromEntries(form));
  const file = await db.assignmentFile.findUniqueOrThrow({ where: { id: d.id }, select: { assignment: { select: { courseId: true } } } });
  await assertCourse(me, file.assignment.courseId);
  await db.assignmentFile.delete({ where: { id: d.id } });
  revalidatePath("/[locale]/teacher/assignments/[id]", "page");
}

export async function deleteAssignment(form: FormData) {
  const me = await requireStaff();
  const d = z.object({ id: z.string().min(1) }).parse(Object.fromEntries(form));
  const a = await db.assignment.findUniqueOrThrow({ where: { id: d.id }, select: { courseId: true, course: { select: { slug: true } } } });
  await assertCourse(me, a.courseId);
  await db.assignment.delete({ where: { id: d.id } });
  refocus(a.course.slug);
  revalidatePath("/[locale]/teacher/assignments/[id]", "page");
}

const notifyGraded = async (submissionId: string, revision: number) => {
  const sub = await db.submission.findUniqueOrThrow({
    where: { id: submissionId },
    select: {
      id: true,
      studentId: true,
      assignment: { select: { title: true, course: { select: { slug: true } } } },
    },
  });
  const parents = await db.parentLink.findMany({ where: { studentId: sub.studentId }, select: { parentId: true } });
  const href = `/courses/${sub.assignment.course.slug}/assignments/${sub.id}`;
  const titleAr = `تم تصحيح: ${sub.assignment.title}`;
  const titleEn = `Graded: ${sub.assignment.title}`;
  for (const userId of [sub.studentId, ...parents.map((p) => p.parentId)]) {
    await db.notification
      .create({
        data: { userId, kind: "SUBMISSION_GRADED", titleAr, titleEn, href, dedupeKey: `sub-graded:${submissionId}:${revision}:${userId}` },
      })
      .catch(() => null);
  }
};

/** Score it, or return it for a redo with a required note. */
export type GradeError = "invalid" | "invalid_score" | "feedback_required" | "ok" | null;

export async function gradeSubmission(_prev: GradeError, form: FormData): Promise<GradeError> {
  const me = await requireStaff();
  const parsed = z
    .object({
      id: z.string().min(1),
      mode: z.enum(["grade", "return"]),
      score: z.string().optional(),
      feedback: z.string().trim().max(4000).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return "invalid";
  const d = parsed.data;

  const sub = await db.submission.findUniqueOrThrow({
    where: { id: d.id },
    select: { id: true, revision: true, assignment: { select: { courseId: true, maxScore: true, course: { select: { slug: true, instructorId: true } } } } },
  });
  await assertCourse(me, sub.assignment.courseId);

  const feedback = d.feedback ? maskContacts(d.feedback).text : null;

  if (d.mode === "return") {
    if (!feedback) return "feedback_required";
    await db.submission.update({ where: { id: d.id }, data: { status: "RETURNED", score: null, feedback, gradedAt: new Date(), gradedById: me.id } });
  } else {
    const score = Number(d.score);
    if (!Number.isInteger(score) || score < 0 || score > sub.assignment.maxScore) return "invalid_score";
    await db.submission.update({ where: { id: d.id }, data: { status: "GRADED", score, feedback, gradedAt: new Date(), gradedById: me.id } });
  }

  await notifyGraded(d.id, sub.revision);
  revalidatePath("/[locale]/teacher/assignments/[id]", "page");
  revalidatePath("/[locale]/courses/[slug]/assignments/[assignmentId]", "page");
  revalidatePath("/[locale]/dashboard", "page");
  revalidatePath("/[locale]/parent", "page");
  return "ok";
}

export type AiError = "unavailable" | "limited" | "ok" | "invalid" | null;

/** A suggestion, never a grade: it is written beside the teacher's box and the teacher still confirms. */
export async function gradeWithAi(_prev: AiError, form: FormData): Promise<AiError> {
  const me = await requireStaff();
  const parsed = z.object({ id: z.string().min(1) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return "invalid";

  const submission = await db.submission.findUnique({
    where: { id: parsed.data.id },
    select: {
      id: true,
      text: true,
      files: { select: { pathname: true, contentType: true } },
      assignment: { select: { courseId: true, title: true, instructions: true, maxScore: true } },
    },
  });
  if (!submission) return "invalid";
  await assertCourse(me, submission.assignment.courseId);
  if (await isLimited(`ai-grade:${me.id}`, 100, 86_400_000)) return "limited";

  const result = await requestAiGrade({
    title: submission.assignment.title,
    instructions: submission.assignment.instructions,
    maxScore: submission.assignment.maxScore,
    text: submission.text,
    files: submission.files,
  });
  if (!result) return "unavailable";

  await recordAttempt(`ai-grade:${me.id}`);
  await db.submission.update({
    where: { id: submission.id },
    data: {
      aiScore: result.score,
      aiFeedback: [result.rationale, `confidence: ${result.confidence}`].filter(Boolean).join("\n").slice(0, 4000),
    },
  });

  revalidatePath("/[locale]/teacher/assignments/[id]", "page");
  return "ok";
}
