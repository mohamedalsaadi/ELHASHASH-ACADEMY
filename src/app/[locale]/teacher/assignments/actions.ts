"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MAX_FILE_BYTES, MAX_FILES, blobInfo, homeworkPrefix } from "@/lib/blob";
import { suggestGrade } from "@/lib/ai-grading";
import { opensAssignment } from "@/lib/assignments";
import { grantsFor } from "@/lib/catalog";
import { hasStudentToken, isAllowedQuizLink, studentCode } from "@/lib/external-link";
import { fetchCodeEntry } from "@/lib/google-form";
import { buildReport, codeColumn, parseTable, scoreColumn, scoreFromCell, type Report } from "@/lib/quiz-report";
import { scaleScore } from "@/lib/exams";
import { maskContacts } from "@/lib/contact-guard";
import { db } from "@/lib/db";
import { hasGuardianConsent } from "@/lib/live";
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

/**
 * What to store for a quiz link. A Google Form without the {student} placeholder is opened once here to find its "Student code"
 * question, so the teacher only pastes the normal link; the stored address is the plain form address (no query).
 */
async function prepareLink(kind: "HOMEWORK" | "QUIZ", linkUrl: string | undefined) {
  if (!linkUrl) return { linkUrl: null, linkEntry: null };
  if (kind !== "QUIZ" || hasStudentToken(linkUrl)) return { linkUrl, linkEntry: null };
  const found = await fetchCodeEntry(linkUrl);
  return found ? { linkUrl: found.url, linkEntry: found.entry } : { linkUrl, linkEntry: null };
}

/** Form state for the authoring screens: null means "fine", anything else is a message key. */
export type AssignmentError = "invalid" | "lesson" | "link" | null;

export async function createAssignment(_prev: AssignmentError, form: FormData): Promise<AssignmentError> {
  const me = await requireStaff();
  const parsed = z
    .object({
      courseId: z.string().min(1),
      lessonId: z.string().optional(),
      kind: z.enum(["HOMEWORK", "QUIZ"]).default("HOMEWORK"),
      title: z.string().trim().min(3).max(200),
      instructions: z.string().trim().max(8000).optional(),
      linkUrl: z.union([z.literal(""), z.string().trim().url().max(500).regex(/^https:\/\//)]).optional(),
      rubric: z.string().trim().max(4000).optional(),
      dueAt: z.string().optional(),
      maxScore: z.coerce.number().int().min(1).max(1000).default(100),
      allowResubmit: z.string().optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return "invalid";
  const d = parsed.data;

  // A quiz that lives elsewhere may only point at Google Forms; homework may link to any https page.
  if (d.kind === "QUIZ" && d.linkUrl && !isAllowedQuizLink(d.linkUrl)) return "link";

  const course = await db.course.findUniqueOrThrow({ where: { id: d.courseId }, select: { slug: true, instructorId: true } });
  await assertCourse(me, d.courseId);

  let lessonId: string | null = null;
  if (d.lessonId) {
    const lesson = await db.lesson.findUnique({ where: { id: d.lessonId }, select: { unit: { select: { courseId: true } } } });
    if (!lesson || lesson.unit.courseId !== d.courseId) return "lesson";
    lessonId = d.lessonId;
  }

  const link = await prepareLink(d.kind, d.linkUrl);
  const created = await db.assignment.create({
    data: {
      courseId: d.courseId,
      lessonId,
      createdById: me.id,
      kind: d.kind,
      title: d.title,
      instructions: d.instructions || null,
      ...link,
      rubric: d.rubric || null,
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
        titleAr: `${d.kind === "QUIZ" ? "اختبار جديد" : "واجب جديد"}: ${d.title}`,
        titleEn: `${d.kind === "QUIZ" ? "New quiz" : "New homework"}: ${d.title}`,
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
      linkUrl: z.union([z.literal(""), z.string().trim().url().max(500).regex(/^https:\/\//)]).optional(),
      rubric: z.string().trim().max(4000).optional(),
      dueAt: z.string().optional(),
      maxScore: z.coerce.number().int().min(1).max(1000),
      allowResubmit: z.string().optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return "invalid";
  const d = parsed.data;

  const a = await db.assignment.findUniqueOrThrow({ where: { id: d.id }, select: { courseId: true, kind: true, course: { select: { slug: true } } } });
  await assertCourse(me, a.courseId);
  if (a.kind === "QUIZ" && d.linkUrl && !isAllowedQuizLink(d.linkUrl)) return "link";

  const link = await prepareLink(a.kind, d.linkUrl);
  await db.assignment.update({
    where: { id: d.id },
    data: {
      title: d.title,
      instructions: d.instructions || null,
      ...link,
      rubric: d.rubric || null,
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
      assignment: { select: { id: true, title: true, course: { select: { slug: true } } } },
    },
  });
  const parents = await db.parentLink.findMany({ where: { studentId: sub.studentId }, select: { parentId: true } });
  const href = `/courses/${sub.assignment.course.slug}/assignments/${sub.assignment.id}`;
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

export type AiError = "unavailable" | "limited" | "ok" | "invalid" | "off" | "consent" | null;

/** A suggestion, never a grade: it is written beside the teacher's box and the teacher still confirms. */
export async function gradeWithAi(_prev: AiError, form: FormData): Promise<AiError> {
  const me = await requireStaff();
  const parsed = z.object({ id: z.string().min(1) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return "invalid";

  const submission = await db.submission.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, studentId: true, assignment: { select: { courseId: true, course: { select: { aiGrading: true } } } } },
  });
  if (!submission) return "invalid";
  await assertCourse(me, submission.assignment.courseId);
  // Same two gates as the automatic path: the course opted in, and a guardian consented for this student.
  if (!submission.assignment.course.aiGrading) return "off";
  if (!(await hasGuardianConsent(submission.studentId))) return "consent";
  if (await isLimited(`ai-grade:${me.id}`, 100, 86_400_000)) return "limited";

  if (!(await suggestGrade(submission.id))) return "unavailable";
  await recordAttempt(`ai-grade:${me.id}`);

  revalidatePath("/[locale]/teacher/assignments/[id]", "page");
  return "ok";
}

/** Adds a question from the course's bank to this assignment, or takes it off again. Quizzes and homework with questions are made this way. */
export async function toggleAssignmentItem(form: FormData) {
  const me = await requireStaff();
  const d = z.object({ assignmentId: z.string().min(1), itemId: z.string().min(1) }).parse(Object.fromEntries(form));
  const a = await db.assignment.findUniqueOrThrow({ where: { id: d.assignmentId }, select: { courseId: true } });
  await assertCourse(me, a.courseId);
  // Only a question of this course's own lessons.
  const item = await db.questionItem.findFirst({ where: { id: d.itemId, courseId: a.courseId }, select: { id: true } });
  if (!item) return;
  const key = { assignmentId_itemId: { assignmentId: d.assignmentId, itemId: d.itemId } };
  if (await db.assignmentItem.findUnique({ where: key })) await db.assignmentItem.delete({ where: key });
  else await db.assignmentItem.create({ data: { assignmentId: d.assignmentId, itemId: d.itemId, order: await db.assignmentItem.count({ where: { assignmentId: d.assignmentId } }) } });
  revalidatePath("/[locale]/teacher/assignments/[id]", "page");
  revalidatePath("/[locale]/courses/[slug]/assignments/[assignmentId]", "page");
}

export type CheckState = { error: "file" | "empty" | "column" | "big" | "score" } | { report: Report; saved?: { saved: number; skipped: number } } | null;

const MAX_ROWS = 1500;

/**
 * Turns a Google Form's downloaded responses into a report: each row's student code becomes a student of this course, with
 * a verdict (subscribed, plan ended, not recognised, used twice, no code). With `save` the scores of the good rows are also
 * kept as graded submissions, so the student, the parent and the analytics see them. A code that appears twice is never saved.
 */
export async function checkResponses(_prev: CheckState, form: FormData): Promise<CheckState> {
  const me = await requireStaff();
  const id = z.string().min(1).parse(form.get("id"));
  const save = form.get("save") === "1";
  const a = await db.assignment.findUniqueOrThrow({
    where: { id },
    select: { id: true, courseId: true, maxScore: true, course: { select: { slug: true } }, lesson: { select: { id: true, month: true, unit: { select: { term: true, isFree: true } } } } },
  });
  await assertCourse(me, a.courseId);

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 2_000_000) return { error: "file" };
  const table = parseTable(await file.text());
  if (table.length < 2) return { error: "empty" };
  if (table.length > MAX_ROWS + 1) return { error: "big" };
  const col = codeColumn(table);
  if (col < 0) return { error: "column" };
  const scoreCol = scoreColumn(table[0]);
  if (save && scoreCol < 0) return { error: "score" };

  const holders = await db.entitlement.findMany({ where: { courseId: a.courseId }, distinct: ["userId"], select: { userId: true, user: { select: { name: true } } }, take: 3000 });
  const byCode = new Map(holders.map((h) => [studentCode(h.userId, a.id), h]));
  const wanted = [...new Set(table.slice(1).map((r) => (r[col] ?? "").trim().toUpperCase()))].map((c) => byCode.get(c)).filter((h) => !!h);

  // Whether each matched student may open the quiz today: checked a few at a time, only for students that appear in the file.
  const now = new Date();
  const open = new Map<string, boolean>();
  for (let i = 0; i < wanted.length; i += 20) {
    await Promise.all(wanted.slice(i, i + 20).map(async (h) => open.set(h!.userId, opensAssignment(a, await grantsFor(h!.userId, a.courseId, now), now))));
  }

  const report = buildReport(table, (code) => {
    const h = byCode.get(code);
    return h ? { name: h.user.name ?? "", subscribed: open.get(h.userId) ?? false } : null;
  });
  if (!report) return { error: "column" };
  if (!save) return { report };

  const times = new Map<string, number>();
  for (const r of report.rows) if (r.code) times.set(r.code, (times.get(r.code) ?? 0) + 1);
  let saved = 0;
  for (const r of report.rows) {
    const h = byCode.get(r.code);
    const s = scoreFromCell(r.cells[scoreCol] ?? "");
    if (r.verdict !== "ok" || times.get(r.code) !== 1 || !h || !s) continue;
    const score = s.max ? scaleScore(s.marks, s.max, a.maxScore) : Math.min(a.maxScore, Math.max(0, Math.round(s.marks)));
    const sub = await db.submission.upsert({
      where: { assignmentId_studentId: { assignmentId: a.id, studentId: h.userId } },
      create: { assignmentId: a.id, studentId: h.userId, status: "GRADED", score, gradedAt: now, gradedById: null },
      update: { status: "GRADED", score, gradedAt: now, gradedById: null },
      select: { id: true, revision: true },
    });
    await notifyGraded(sub.id, sub.revision);
    saved++;
  }
  revalidatePath("/[locale]/teacher/assignments/[id]", "page");
  revalidatePath("/[locale]/courses/[slug]/assignments/[assignmentId]", "page");
  revalidatePath("/[locale]/courses/[slug]/assignments", "page");
  revalidatePath("/[locale]/dashboard", "page");
  revalidatePath("/[locale]/parent", "page");
  return { report, saved: { saved, skipped: report.rows.length - saved } };
}
