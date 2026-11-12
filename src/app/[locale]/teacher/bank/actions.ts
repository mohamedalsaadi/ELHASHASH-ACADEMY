"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { ownPaths, questionMediaPrefix } from "@/lib/blob";
import { parseQuestionCsv, TRUE_FALSE_LABELS } from "@/lib/exams";
import { assertCourse, requireStaff } from "@/lib/staff";

export type BankError = "invalid" | "ok" | null;

const ItemInput = z.object({
  kind: z.enum(["MCQ", "MULTI", "TRUE_FALSE", "SHORT", "WRITTEN"]),
  prompt: z.string().trim().max(2000).default(""),
  answer: z.string().trim().max(1000).optional(),
  explanation: z.string().trim().max(4000).optional(),
  marks: z.coerce.number().int().min(1).max(100).default(1),
  media: z.string().max(20_000).default("[]"),
  tf: z.enum(["true", "false"]).optional(),
});

type StoredKind = "MCQ" | "MULTI" | "SHORT" | "WRITTEN";

const courseOfLesson = async (lessonId: string) => {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { unit: { select: { courseId: true } } } });
  return lesson?.unit.courseId ?? null;
};

/**
 * Where a new question goes: a lesson (then it also shows in that lesson's practice) or just a course. The form sends
 * `courseId`, and optionally `lessonId`; a lesson of another course is refused. Null when it cannot be placed.
 */
async function placeFor(form: FormData): Promise<{ courseId: string; lessonId: string | null } | null> {
  const lessonId = String(form.get("lessonId") ?? "") || null;
  let courseId = String(form.get("courseId") ?? "") || null;
  if (lessonId) {
    const owner = await courseOfLesson(lessonId);
    if (!owner || (courseId && courseId !== owner)) return null;
    courseId = owner;
  }
  return courseId ? { courseId, lessonId } : null;
}

/**
 * Reads the form into one question. Options are the `choice` fields (blank rows are dropped), the ticked `correct` fields are
 * row numbers. True/false is saved as a one-answer multiple-choice question with two fixed options. Null when the question
 * cannot stand: no text and no picture, fewer than two options, no correct option, or more than one on a one-answer question.
 */
function readItem(form: FormData, courseId: string) {
  const parsed = ItemInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return null;
  const d = parsed.data;
  const media = ownPaths(z.array(z.string()).max(40).catch([]).parse(JSON.parse(d.media || "[]")), questionMediaPrefix(courseId));
  if (d.prompt.length < 3 && media.length === 0) return null;

  const kind: StoredKind = d.kind === "TRUE_FALSE" ? "MCQ" : d.kind;
  const labels: string[] = [];
  const correctRows: number[] = [];
  if (d.kind === "TRUE_FALSE") {
    if (!d.tf) return null;
    labels.push(...TRUE_FALSE_LABELS);
    correctRows.push(d.tf === "true" ? 0 : 1);
  } else if (kind === "MCQ" || kind === "MULTI") {
    const rows = form.getAll("choice").map((v) => String(v).trim().slice(0, 500));
    const ticked = new Set(form.getAll("correct").map(Number));
    // A blank row is dropped, and the ticks move with their rows.
    rows.slice(0, 6).forEach((label, i) => {
      if (!label) return;
      if (ticked.has(i)) correctRows.push(labels.length);
      labels.push(label);
    });
    if (labels.length < 2 || correctRows.length === 0) return null;
    if (kind === "MCQ" && correctRows.length !== 1) return null;
  } else if (kind === "SHORT" && !d.answer) return null;
  return { d, kind, prompt: d.prompt, media, labels, correctRows };
}

const refresh = () => {
  revalidatePath("/[locale]/teacher/bank/[lessonId]", "page");
  revalidatePath("/[locale]/admin/courses/[id]/questions", "page");
};

export async function createItem(_prev: BankError, form: FormData): Promise<BankError> {
  const me = await requireStaff();
  const place = await placeFor(form);
  if (!place) return "invalid";
  await assertCourse(me, place.courseId);
  const r = readItem(form, place.courseId);
  if (!r) return "invalid";
  const { d } = r;

  const order = (await db.questionItem.count({ where: place.lessonId ? { lessonId: place.lessonId } : { courseId: place.courseId, lessonId: null } })) + 1;
  await db.questionItem.create({
    data: {
      courseId: place.courseId,
      lessonId: place.lessonId,
      createdById: me.id,
      kind: r.kind,
      prompt: r.prompt,
      media: r.media,
      explanation: d.explanation || null,
      marks: d.marks,
      order,
      answer: r.kind === "SHORT" || r.kind === "WRITTEN" ? d.answer || null : null,
      choices: { create: r.labels.map((label, i) => ({ label, correct: r.correctRows.includes(i), order: i })) },
    },
  });
  refresh();
  return "ok";
}

/** Edits a question. Choices are updated in place by position so past answers keep pointing at their choice. */
export async function updateItem(_prev: BankError, form: FormData): Promise<BankError> {
  const me = await requireStaff();
  const id = String(form.get("id") ?? "");
  const item = await db.questionItem.findUnique({ where: { id }, select: { courseId: true, lessonId: true, choices: { orderBy: { order: "asc" }, select: { id: true } } } });
  if (!item) return "invalid";
  await assertCourse(me, item.courseId);
  const r = readItem(form, item.courseId);
  if (!r) return "invalid";
  const { d } = r;
  // The lesson link can be changed or removed from the course workspace; a lesson of another course is refused.
  let lessonId = item.lessonId;
  if (form.has("lessonId")) {
    lessonId = String(form.get("lessonId") ?? "") || null;
    if (lessonId && (await courseOfLesson(lessonId)) !== item.courseId) return "invalid";
  }

  await db.$transaction(async (tx) => {
    await tx.questionItem.update({
      where: { id },
      data: {
        lessonId,
        kind: r.kind,
        prompt: r.prompt,
        media: r.media,
        explanation: d.explanation || null,
        marks: d.marks,
        answer: r.kind === "SHORT" || r.kind === "WRITTEN" ? d.answer || null : null,
      },
    });
    for (const [i, label] of r.labels.entries()) {
      const data = { label, correct: r.correctRows.includes(i), order: i };
      if (item.choices[i]) await tx.questionChoice.update({ where: { id: item.choices[i].id }, data });
      else await tx.questionChoice.create({ data: { ...data, itemId: id } });
    }
    const drop = item.choices.slice(r.labels.length).map((c) => c.id);
    if (drop.length) await tx.questionChoice.deleteMany({ where: { id: { in: drop } } });
  });
  refresh();
  return "ok";
}

/** Pastes many questions at once: `prompt | choice;choice | correct number (or 1,3) | marks`, one per line. All or nothing. */
export async function importItems(_prev: BankError, form: FormData): Promise<BankError> {
  const me = await requireStaff();
  const csv = z.string().max(60_000).safeParse(form.get("csv"));
  const place = await placeFor(form);
  if (!csv.success || !place) return "invalid";
  await assertCourse(me, place.courseId);

  const { rows, bad } = parseQuestionCsv(csv.data);
  if (bad.length > 0 || rows.length === 0 || rows.length > 100) return "invalid";

  let order = await db.questionItem.count({ where: place.lessonId ? { lessonId: place.lessonId } : { courseId: place.courseId, lessonId: null } });
  for (const r of rows) {
    order += 1;
    const common = { courseId: place.courseId, lessonId: place.lessonId, createdById: me.id, prompt: r.prompt, marks: r.marks, order };
    if (r.kind === "MCQ" || r.kind === "MULTI") {
      const right = r.kind === "MCQ" ? [r.correct] : r.correct;
      await db.questionItem.create({
        data: { ...common, kind: r.kind, choices: { create: r.choices.map((label, i) => ({ label, correct: right.includes(i + 1), order: i })) } },
      });
    } else {
      await db.questionItem.create({ data: { ...common, kind: "SHORT", answer: r.answer } });
    }
  }
  refresh();
  return "ok";
}

export async function deleteItem(form: FormData) {
  const me = await requireStaff();
  const d = z.object({ id: z.string().min(1) }).parse(Object.fromEntries(form));
  const item = await db.questionItem.findUniqueOrThrow({ where: { id: d.id }, select: { courseId: true } });
  await assertCourse(me, item.courseId);
  await db.questionItem.delete({ where: { id: d.id } });
  refresh();
}

/** The leaderboard is opt-in per course and only ever shown to that course's own students. */
export async function toggleLeaderboard(form: FormData) {
  const me = await requireStaff();
  const d = z.object({ courseId: z.string().min(1), on: z.string().optional() }).parse(Object.fromEntries(form));
  await assertCourse(me, d.courseId);
  await db.course.update({ where: { id: d.courseId }, data: { leaderboard: d.on === "on" } });
  revalidatePath("/[locale]/teacher/bank", "page");
  revalidatePath("/[locale]/courses/[slug]/leaderboard", "page");
}
