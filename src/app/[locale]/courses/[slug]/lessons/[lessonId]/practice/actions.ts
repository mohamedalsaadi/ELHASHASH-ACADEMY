"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { grantsFor } from "@/lib/catalog";
import { db } from "@/lib/db";
import { opensLesson } from "@/lib/plans";
import { scoreAttempt, type PracticeError, type PracticeReply } from "@/lib/practice";
import { awardPractice } from "@/lib/progress-db";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { recordReview } from "@/lib/review-db";

/**
 * Marks one practice run. Answers are marked here from the database, never from the client,
 * and the attempt is stored so mastery and the leaderboard have history to read.
 */
export async function submitPractice(_prev: PracticeError, form: FormData): Promise<PracticeError> {
  const session = await auth();
  if (!session?.user) notFound();
  const userId = session.user.id;

  const parsed = z.object({ lessonId: z.string().min(1) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return "invalid";

  const lesson = await db.lesson.findUnique({
    where: { id: parsed.data.lessonId },
    select: {
      id: true,
      month: true,
      unit: { select: { term: true, isFree: true, courseId: true, course: { select: { slug: true } } } },
      questionItems: {
        where: { active: true, kind: { in: ["MCQ", "SHORT"] } },
        orderBy: { order: "asc" },
        select: { id: true, kind: true, marks: true, answer: true, choices: { select: { id: true, correct: true } } },
      },
    },
  });
  if (!lesson) notFound();

  const now = new Date();
  const grants = await grantsFor(userId, lesson.unit.courseId, now);
  const open =
    lesson.unit.isFree || grants.some((g) => opensLesson(g, { id: lesson.id, month: lesson.month, term: lesson.unit.term }, now));
  if (!open) return "closed";
  if (lesson.questionItems.length === 0) return "invalid";
  if (await isLimited(`practice:${userId}`, 50, 86_400_000)) return "limited";

  const replies: PracticeReply[] = lesson.questionItems.map((item) => ({
    itemId: item.id,
    choiceId: String(form.get(`choice_${item.id}`) ?? "") || null,
    text: String(form.get(`text_${item.id}`) ?? "") || null,
  }));

  const score = scoreAttempt(lesson.questionItems, replies);
  const progress = await awardPractice(userId, score.correct, lesson.questionItems.length);
  await recordReview(userId, lesson.id, score.correct, lesson.questionItems.length, now);

  const attempt = await db.practiceAttempt.create({
    data: {
      userId,
      lessonId: lesson.id,
      marks: score.marks,
      maxMarks: score.maxMarks,
      xp: progress?.xp ?? 0,
      answers: {
        create: score.results.map((r) => ({
          itemId: r.item.id,
          correct: r.correct,
          choiceId: r.item.kind === "MCQ" ? (replies.find((x) => x.itemId === r.item.id)?.choiceId ?? null) : null,
          text: r.item.kind === "SHORT" ? (replies.find((x) => x.itemId === r.item.id)?.text ?? null) : null,
        })),
      },
    },
    select: { id: true },
  });

  await recordAttempt(`practice:${userId}`);
  revalidatePath("/[locale]/dashboard", "page");
  redirect(`/courses/${lesson.unit.course.slug}/lessons/${lesson.id}/practice?attempt=${attempt.id}`);
}
