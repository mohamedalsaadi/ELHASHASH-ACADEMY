"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { grantsFor } from "@/lib/catalog";
import { db } from "@/lib/db";
import { markExam } from "@/lib/exams";
import { opensLesson } from "@/lib/plans";
import type { PracticeError, PracticeReply } from "@/lib/practice";
import { isLimited, recordAttempt } from "@/lib/rate-limit";

/** Starts a paper, or resumes the one already open. The clock lives in the database, not the browser. */
export async function startExam(form: FormData) {
  const session = await auth();
  if (!session?.user) notFound();
  const d = z.object({ paperId: z.string().min(1) }).parse(Object.fromEntries(form));

  const paper = await db.examPaper.findUnique({
    where: { id: d.paperId, published: true },
    select: { id: true, durationMin: true, courseId: true, course: { select: { slug: true } }, items: { select: { item: { select: { marks: true } } } } },
  });
  if (!paper) notFound();
  if (paper.items.length === 0) notFound();

  const existing = await db.examAttempt.findFirst({
    where: { paperId: paper.id, userId: session.user.id, status: "IN_PROGRESS" },
    select: { id: true },
  });
  if (!existing) {
    const maxMarks = paper.items.reduce((sum, i) => sum + i.item.marks, 0);
    await db.examAttempt.create({
      data: {
        paperId: paper.id,
        userId: session.user.id,
        expiresAt: new Date(Date.now() + paper.durationMin * 60_000),
        maxMarks,
      },
    });
  }
  redirect(`/courses/${paper.course.slug}/exams/${paper.id}`);
}

/** Marks the objective items now and leaves any written answers for the teacher. */
export async function submitExam(_prev: PracticeError, form: FormData): Promise<PracticeError> {
  const session = await auth();
  if (!session?.user) notFound();
  const d = z.object({ attemptId: z.string().min(1) }).safeParse(Object.fromEntries(form));
  if (!d.success) return "invalid";

  const attempt = await db.examAttempt.findFirst({
    where: { id: d.data.attemptId, userId: session.user.id, status: "IN_PROGRESS" },
    select: {
      id: true,
      paperId: true,
      paper: {
        select: {
          course: { select: { slug: true } },
          items: { orderBy: { order: "asc" }, select: { item: { select: { id: true, kind: true, marks: true, answer: true, choices: { select: { id: true, correct: true } } } } } },
        },
      },
    },
  });
  if (!attempt) return "invalid";
  if (await isLimited(`exam:${session.user.id}`, 20, 86_400_000)) return "limited";

  const items = attempt.paper.items.map((i) => i.item);
  const replies: PracticeReply[] = items.map((item) => ({
    itemId: item.id,
    choiceId: String(form.get(`choice_${item.id}`) ?? "") || null,
    text: String(form.get(`text_${item.id}`) ?? "") || null,
  }));

  const marked = markExam(items, replies);
  const now = new Date();

  await db.$transaction([
    db.examAnswer.deleteMany({ where: { attemptId: attempt.id } }),
    db.examAnswer.createMany({
      data: marked.results.map((r) => {
        const reply = replies.find((x) => x.itemId === r.itemId);
        const item = items.find((i) => i.id === r.itemId)!;
        return {
          attemptId: attempt.id,
          itemId: r.itemId,
          correct: r.correct,
          marks: r.marks,
          choiceId: item.kind === "MCQ" ? reply?.choiceId ?? null : null,
          text: item.kind === "SHORT" || item.kind === "WRITTEN" ? reply?.text ?? null : null,
        };
      }),
    }),
    db.examAttempt.update({
      where: { id: attempt.id },
      data: {
        status: marked.needsGrading ? "SUBMITTED" : "GRADED",
        submittedAt: now,
        marks: marked.autoMarks,
        maxMarks: marked.maxMarks,
        gradedAt: marked.needsGrading ? null : now,
      },
    }),
  ]);

  await recordAttempt(`exam:${session.user.id}`);
  revalidatePath("/[locale]/teacher/exams/[id]", "page");
  revalidatePath("/[locale]/courses/[slug]/exams/[examId]", "page");
  redirect(`/courses/${attempt.paper.course.slug}/exams/${attempt.paperId}`);
}
