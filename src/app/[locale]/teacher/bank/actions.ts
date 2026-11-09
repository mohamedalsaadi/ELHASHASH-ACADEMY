"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertCourse, requireStaff } from "@/lib/staff";

export type BankError = "invalid" | "ok" | null;

const ItemInput = z.object({
  lessonId: z.string().min(1),
  kind: z.enum(["MCQ", "SHORT", "WRITTEN"]),
  prompt: z.string().trim().min(3).max(2000),
  answer: z.string().trim().max(1000).optional(),
  explanation: z.string().trim().max(4000).optional(),
  marks: z.coerce.number().int().min(1).max(100).default(1),
  choices: z.string().optional(),
  correct: z.string().optional(),
});

const courseOfLesson = async (lessonId: string) => {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { unit: { select: { courseId: true } } } });
  return lesson?.unit.courseId ?? null;
};

export async function createItem(_prev: BankError, form: FormData): Promise<BankError> {
  const me = await requireStaff();
  const parsed = ItemInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return "invalid";
  const d = parsed.data;

  const courseId = await courseOfLesson(d.lessonId);
  if (!courseId) return "invalid";
  await assertCourse(me, courseId);

  const order = (await db.questionItem.count({ where: { lessonId: d.lessonId } })) + 1;
  const common = { lessonId: d.lessonId, createdById: me.id, prompt: d.prompt, explanation: d.explanation || null, marks: d.marks, order };

  if (d.kind === "MCQ") {
    const labels = (d.choices ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);
    const index = Number(d.correct) - 1;
    if (labels.length < 2 || !Number.isInteger(index) || index < 0 || index >= labels.length) return "invalid";
    await db.questionItem.create({
      data: { ...common, kind: "MCQ", choices: { create: labels.map((label, i) => ({ label, correct: i === index, order: i })) } },
    });
  } else if (d.kind === "WRITTEN") {
    // Marked by the teacher; the answer field is an optional model answer for them.
    await db.questionItem.create({ data: { ...common, kind: "WRITTEN", answer: d.answer || null } });
  } else {
    if (!d.answer) return "invalid";
    await db.questionItem.create({ data: { ...common, kind: "SHORT", answer: d.answer } });
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
