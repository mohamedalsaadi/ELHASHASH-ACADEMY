"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { hasPlan } from "@/lib/assignments";
import { grantsFor, isCourseStaff } from "@/lib/catalog";
import { suggestWritten } from "@/lib/ai-grading";
import { db } from "@/lib/db";
import { hasGuardianConsent } from "@/lib/live";
import { isExpired, markExam } from "@/lib/exams";
import { opensLesson } from "@/lib/plans";
import { replyFrom, type PracticeError, type PracticeReply } from "@/lib/practice";
import { isLimited, recordAttempt } from "@/lib/rate-limit";

/** Starts a paper, or resumes the one already open. The clock lives in the database, not the browser. */
export async function startExam(form: FormData) {
  const session = await auth();
  if (!session?.user) notFound();
  const d = z.object({ paperId: z.string().min(1) }).parse(Object.fromEntries(form));

  const paper = await db.examPaper.findUnique({
    where: { id: d.paperId, published: true },
    select: { id: true, durationMin: true, maxAttempts: true, courseId: true, course: { select: { slug: true, instructorId: true } }, items: { select: { item: { select: { marks: true } } } } },
  });
  if (!paper) notFound();
  if (paper.items.length === 0) notFound();

  // Same rule as the paper page, with one addition: a student may always resume an attempt they
  // legitimately started, even if the plan has ended since. Creating a new one needs a running plan.
  const [existing, used] = await Promise.all([
    db.examAttempt.findFirst({ where: { paperId: paper.id, userId: session.user.id, status: "IN_PROGRESS" }, select: { id: true } }),
    db.examAttempt.count({ where: { paperId: paper.id, userId: session.user.id } }),
  ]);
  if (!existing && !isCourseStaff(session.user, paper.course)) {
    const grants = await grantsFor(session.user.id, paper.courseId);
    if (!hasPlan(grants, new Date())) redirect(`/courses/${paper.course.slug}#packages`);
  }
  // A fresh attempt only while the student has one left, and never while one is already open.
  if (!existing && used < paper.maxAttempts) {
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
      expiresAt: true,
      paper: {
        select: {
          course: { select: { id: true, slug: true, aiGrading: true } },
          items: { orderBy: { order: "asc" }, select: { item: { select: { id: true, kind: true, marks: true, answer: true, choices: { select: { id: true, correct: true } } } } } },
        },
      },
    },
  });
  if (!attempt) return "invalid";
  if (await isLimited(`exam:${session.user.id}`, 20, 86_400_000)) return "limited";

  const now = new Date();
  // The clock is the server's. Past the grace window the answers are not accepted: the attempt closes with
  // no marks, and the teacher can allow another attempt. The browser timer only submits early enough to avoid this.
  if (isExpired(attempt.expiresAt, now)) {
    await db.examAttempt.update({ where: { id: attempt.id }, data: { status: "GRADED", submittedAt: now, gradedAt: now, marks: 0 } });
    revalidatePath("/[locale]/courses/[slug]/exams/[examId]", "page");
    redirect(`/courses/${attempt.paper.course.slug}/exams/${attempt.paperId}`);
  }

  const items = attempt.paper.items.map((i) => i.item);
  const replies: PracticeReply[] = items.map((item) => replyFrom(form, item.id));

  const marked = markExam(items, replies);

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
          choiceIds: item.kind === "MULTI" ? reply?.choiceIds ?? [] : [],
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
  // A suggested mark for each written answer is waiting when the teacher opens the attempt. Only for a course that opted in
  // (the answer leaves our servers for an AI provider), with a guardian's consent, and capped per course like homework.
  if (marked.needsGrading && attempt.paper.course.aiGrading && (await hasGuardianConsent(session.user.id))) {
    const key = `ai-auto:${attempt.paper.course.id}`;
    after(async () => {
      if (await isLimited(key, 300, 86_400_000)) return;
      if ((await suggestWritten(attempt.id).catch(() => 0)) > 0) await recordAttempt(key);
    });
  }
  revalidatePath("/[locale]/teacher/exams/[id]", "page");
  revalidatePath("/[locale]/courses/[slug]/exams/[examId]", "page");
  redirect(`/courses/${attempt.paper.course.slug}/exams/${attempt.paperId}`);
}
