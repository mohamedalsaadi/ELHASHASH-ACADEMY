"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertCourse, requireStaff } from "@/lib/staff";

export type ExamError = "invalid" | "ok" | null;

export async function createExam(_prev: ExamError, form: FormData): Promise<ExamError> {
  const me = await requireStaff();
  const parsed = z
    .object({
      courseId: z.string().min(1),
      title: z.string().trim().min(3).max(200),
      description: z.string().trim().max(4000).optional(),
      durationMin: z.coerce.number().int().min(5).max(300).default(60),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return "invalid";
  const d = parsed.data;
  await assertCourse(me, d.courseId);

  await db.examPaper.create({
    data: { courseId: d.courseId, createdById: me.id, title: d.title, description: d.description || null, durationMin: d.durationMin },
  });
  revalidatePath("/[locale]/teacher/exams", "page");
  return "ok";
}

export async function updateExam(form: FormData) {
  const me = await requireStaff();
  const d = z
    .object({
      id: z.string().min(1),
      title: z.string().trim().min(3).max(200),
      durationMin: z.coerce.number().int().min(5).max(300),
      maxAttempts: z.coerce.number().int().min(1).max(10).default(1),
      published: z.string().optional(),
    })
    .parse(Object.fromEntries(form));
  const exam = await db.examPaper.findUniqueOrThrow({ where: { id: d.id }, select: { courseId: true } });
  await assertCourse(me, exam.courseId);
  await db.examPaper.update({
    where: { id: d.id },
    data: { title: d.title, durationMin: d.durationMin, maxAttempts: d.maxAttempts, published: d.published === "on" },
  });
  revalidatePath("/[locale]/teacher/exams/[id]", "page");
  revalidatePath("/[locale]/courses/[slug]/exams", "page");
}

/** Adds or removes one bank question from the paper. */
export async function toggleExamItem(form: FormData) {
  const me = await requireStaff();
  const d = z.object({ paperId: z.string().min(1), itemId: z.string().min(1) }).parse(Object.fromEntries(form));
  const exam = await db.examPaper.findUniqueOrThrow({ where: { id: d.paperId }, select: { courseId: true } });
  await assertCourse(me, exam.courseId);

  const existing = await db.examItem.findUnique({ where: { paperId_itemId: { paperId: d.paperId, itemId: d.itemId } }, select: { id: true } });
  if (existing) {
    await db.examItem.delete({ where: { id: existing.id } });
  } else {
    const order = (await db.examItem.count({ where: { paperId: d.paperId } })) + 1;
    await db.examItem.create({ data: { paperId: d.paperId, itemId: d.itemId, order } });
  }
  revalidatePath("/[locale]/teacher/exams/[id]", "page");
}

export async function deleteExam(form: FormData) {
  const me = await requireStaff();
  const d = z.object({ id: z.string().min(1) }).parse(Object.fromEntries(form));
  const exam = await db.examPaper.findUniqueOrThrow({ where: { id: d.id }, select: { courseId: true } });
  await assertCourse(me, exam.courseId);
  await db.examPaper.delete({ where: { id: d.id } });
  revalidatePath("/[locale]/teacher/exams", "page");
}

/** Marks one written answer, then closes the attempt once nothing is left unmarked. */
export async function gradeWritten(_prev: ExamError, form: FormData): Promise<ExamError> {
  const me = await requireStaff();
  const parsed = z
    .object({ answerId: z.string().min(1), marks: z.coerce.number().int().min(0).max(1000) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return "invalid";

  const answer = await db.examAnswer.findUniqueOrThrow({
    where: { id: parsed.data.answerId },
    select: { id: true, attemptId: true, item: { select: { marks: true, kind: true } }, attempt: { select: { paperId: true } } },
  });
  const exam = await db.examPaper.findUniqueOrThrow({ where: { id: answer.attempt.paperId }, select: { courseId: true } });
  await assertCourse(me, exam.courseId);
  if (answer.item.kind !== "WRITTEN" || parsed.data.marks > answer.item.marks) return "invalid";

  await db.examAnswer.update({ where: { id: answer.id }, data: { marks: parsed.data.marks, correct: parsed.data.marks >= answer.item.marks } });

  const answers = await db.examAnswer.findMany({ where: { attemptId: answer.attemptId }, select: { marks: true, correct: true } });
  const done = answers.every((a) => a.correct !== null);
  await db.examAttempt.update({
    where: { id: answer.attemptId },
    data: {
      marks: answers.reduce((sum, a) => sum + (a.marks ?? 0), 0),
      status: done ? "GRADED" : "SUBMITTED",
      gradedAt: done ? new Date() : null,
      gradedById: done ? me.id : null,
    },
  });

  if (done) {
    // The student and any linked parent hear once, when the last written answer is marked.
    const att = await db.examAttempt.findUniqueOrThrow({
      where: { id: answer.attemptId },
      select: { userId: true, paper: { select: { id: true, title: true, course: { select: { slug: true } } } } },
    });
    const parents = await db.parentLink.findMany({ where: { studentId: att.userId }, select: { parentId: true } });
    const href = `/courses/${att.paper.course.slug}/exams/${att.paper.id}`;
    for (const userId of [att.userId, ...parents.map((p) => p.parentId)]) {
      await db.notification
        .create({
          data: {
            userId,
            kind: "SUBMISSION_GRADED",
            titleAr: `نتيجة الاختبار: ${att.paper.title}`,
            titleEn: `Exam result: ${att.paper.title}`,
            href,
            dedupeKey: `exam-graded:${answer.attemptId}:${userId}`,
          },
        })
        .catch(() => null);
    }
  }

  revalidatePath("/[locale]/teacher/exams/[id]", "page");
  revalidatePath("/[locale]/courses/[slug]/exams/[examId]", "page");
  return "ok";
}

/** Plain-form wrapper: the marks input is constrained, so an invalid post simply does nothing. */
export async function gradeWrittenForm(form: FormData) {
  await gradeWritten(null, form);
}
