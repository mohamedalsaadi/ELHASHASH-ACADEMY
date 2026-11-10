"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { ownPaths, questionMediaPrefix } from "@/lib/blob";
import { parseQuestionCsv } from "@/lib/exams";
import { assertCourse, requireStaff } from "@/lib/staff";

export type BankError = "invalid" | "ok" | null;

const ItemInput = z.object({
  lessonId: z.string().min(1),
  kind: z.enum(["MCQ", "MULTI", "SHORT", "WRITTEN"]),
  prompt: z.string().trim().max(2000).default(""),
  answer: z.string().trim().max(1000).optional(),
  explanation: z.string().trim().max(4000).optional(),
  marks: z.coerce.number().int().min(1).max(100).default(1),
  media: z.string().max(20_000).default("[]"),
});

const courseOfLesson = async (lessonId: string) => {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { unit: { select: { courseId: true } } } });
  return lesson?.unit.courseId ?? null;
};

/**
 * Reads the form into one question. Options are the `choice` fields (blank rows are dropped), the ticked `correct` fields are
 * row numbers. Null when the question cannot stand: no text and no picture, fewer than two options, no correct option,
 * or more than one correct option on a one-answer question.
 */
function readItem(form: FormData, courseId: string) {
  const parsed = ItemInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return null;
  const d = parsed.data;
  const media = ownPaths(z.array(z.string()).max(40).catch([]).parse(JSON.parse(d.media || "[]")), questionMediaPrefix(courseId));
  if (d.prompt.length < 3 && media.length === 0) return null;
  const prompt = d.prompt || "";

  const labels: string[] = [];
  const correctRows: number[] = [];
  if (d.kind === "MCQ" || d.kind === "MULTI") {
    const rows = form.getAll("choice").map((v) => String(v).trim().slice(0, 500));
    const ticked = new Set(form.getAll("correct").map(Number));
    // A blank row is dropped, and the ticks move with their rows.
    rows.slice(0, 6).forEach((label, i) => {
      if (!label) return;
      if (ticked.has(i)) correctRows.push(labels.length);
      labels.push(label);
    });
    if (labels.length < 2 || correctRows.length === 0) return null;
    if (d.kind === "MCQ" && correctRows.length !== 1) return null;
  } else if (d.kind === "SHORT" && !d.answer) return null;
  return { d, prompt, media, labels, correctRows };
}

export async function createItem(_prev: BankError, form: FormData): Promise<BankError> {
  const me = await requireStaff();
  const lessonId = String(form.get("lessonId") ?? "");
  const courseId = await courseOfLesson(lessonId);
  if (!courseId) return "invalid";
  await assertCourse(me, courseId);
  const r = readItem(form, courseId);
  if (!r) return "invalid";
  const { d } = r;

  const order = (await db.questionItem.count({ where: { lessonId } })) + 1;
  await db.questionItem.create({
    data: {
      lessonId, createdById: me.id, kind: d.kind, prompt: r.prompt, media: r.media, explanation: d.explanation || null, marks: d.marks, order,
      answer: d.kind === "SHORT" || d.kind === "WRITTEN" ? d.answer || null : null,
      choices: { create: r.labels.map((label, i) => ({ label, correct: r.correctRows.includes(i), order: i })) },
    },
  });
  revalidatePath("/[locale]/teacher/bank/[lessonId]", "page");
  return "ok";
}

/** Edits a question. Choices are updated in place by position so past answers keep pointing at their choice. */
export async function updateItem(_prev: BankError, form: FormData): Promise<BankError> {
  const me = await requireStaff();
  const id = String(form.get("id") ?? "");
  const item = await db.questionItem.findUnique({ where: { id }, select: { lessonId: true, choices: { orderBy: { order: "asc" }, select: { id: true } } } });
  if (!item) return "invalid";
  const courseId = await courseOfLesson(item.lessonId);
  if (!courseId) return "invalid";
  await assertCourse(me, courseId);
  const r = readItem(form, courseId);
  if (!r) return "invalid";
  const { d } = r;

  await db.$transaction(async (tx) => {
    await tx.questionItem.update({
      where: { id },
      data: { kind: d.kind, prompt: r.prompt, media: r.media, explanation: d.explanation || null, marks: d.marks, answer: d.kind === "SHORT" || d.kind === "WRITTEN" ? d.answer || null : null },
    });
    for (const [i, label] of r.labels.entries()) {
      const data = { label, correct: r.correctRows.includes(i), order: i };
      if (item.choices[i]) await tx.questionChoice.update({ where: { id: item.choices[i].id }, data });
      else await tx.questionChoice.create({ data: { ...data, itemId: id } });
    }
    const drop = item.choices.slice(r.labels.length).map((c) => c.id);
    if (drop.length) await tx.questionChoice.deleteMany({ where: { id: { in: drop } } });
  });
  revalidatePath("/[locale]/teacher/bank/[lessonId]", "page");
  return "ok";
}

/** Pastes many questions at once: `prompt | choice;choice | correct number | marks`, one per line. All or nothing. */
export async function importItems(_prev: BankError, form: FormData): Promise<BankError> {
  const me = await requireStaff();
  const d = z.object({ lessonId: z.string().min(1), csv: z.string().max(60_000) }).safeParse(Object.fromEntries(form));
  if (!d.success) return "invalid";
  const courseId = await courseOfLesson(d.data.lessonId);
  if (!courseId) return "invalid";
  await assertCourse(me, courseId);

  const { rows, bad } = parseQuestionCsv(d.data.csv);
  if (bad.length > 0 || rows.length === 0 || rows.length > 100) return "invalid";

  let order = await db.questionItem.count({ where: { lessonId: d.data.lessonId } });
  for (const r of rows) {
    order += 1;
    const common = { lessonId: d.data.lessonId, createdById: me.id, prompt: r.prompt, marks: r.marks, order };
    if (r.kind === "MCQ" || r.kind === "MULTI") {
      const right = r.kind === "MCQ" ? [r.correct] : r.correct;
      await db.questionItem.create({
        data: { ...common, kind: r.kind, choices: { create: r.choices.map((label, i) => ({ label, correct: right.includes(i + 1), order: i })) } },
      });
    } else {
      await db.questionItem.create({ data: { ...common, kind: "SHORT", answer: r.answer } });
    }
  }
  revalidatePath("/[locale]/teacher/bank/[lessonId]", "page");
  return "ok";
}

export async function deleteItem(form: FormData) {
  const me = await requireStaff();
  const d = z.object({ id: z.string().min(1) }).parse(Object.fromEntries(form));
  const item = await db.questionItem.findUniqueOrThrow({ where: { id: d.id }, select: { lessonId: true } });
  const courseId = await courseOfLesson(item.lessonId);
  if (!courseId) return;
  await assertCourse(me, courseId);
  await db.questionItem.delete({ where: { id: d.id } });
  revalidatePath("/[locale]/teacher/bank/[lessonId]", "page");
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
