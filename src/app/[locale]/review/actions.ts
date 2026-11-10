"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { grantsFor } from "@/lib/catalog";
import { db } from "@/lib/db";
import { opensLesson } from "@/lib/plans";
import { replyFrom, scoreAttempt, type PracticeError, type PracticeReply } from "@/lib/practice";
import { awardPractice } from "@/lib/progress-db";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { recordReview } from "@/lib/review-db";

/**
 * A mixed review set: items drawn from several due lessons in one form. Each lesson is marked and
 * rescheduled on its own, so a strong lesson still moves out while a weak one comes back tomorrow.
 */
export async function submitReview(_prev: PracticeError, form: FormData): Promise<PracticeError> {
  const session = await auth();
  if (!session?.user) notFound();
  const userId = session.user.id;

  const ids = [
    ...new Set(
      [...form.keys()]
        .map((k) => /^(?:choice|text)_(.+)$/.exec(k)?.[1])
        .filter((x): x is string => !!x),
    ),
  ];
  if (ids.length === 0) return "invalid";

  const items = await db.questionItem.findMany({
    where: { id: { in: ids }, active: true, kind: { in: ["MCQ", "MULTI", "SHORT"] } },
    select: { id: true, lessonId: true, kind: true, marks: true, answer: true, choices: { select: { id: true, correct: true } } },
  });
  if (items.length === 0) return "invalid";

  const lessonIds = [...new Set(items.map((i) => i.lessonId))];
  const lessons = await db.lesson.findMany({
    where: { id: { in: lessonIds } },
    select: { id: true, month: true, unit: { select: { term: true, isFree: true, courseId: true } } },
  });

  const now = new Date();
  const grantsByCourse = new Map<string, Awaited<ReturnType<typeof grantsFor>>>();
  for (const lesson of lessons) {
    if (lesson.unit.isFree) continue;
    let grants = grantsByCourse.get(lesson.unit.courseId);
    if (!grants) {
      grants = await grantsFor(userId, lesson.unit.courseId, now);
      grantsByCourse.set(lesson.unit.courseId, grants);
    }
    if (!grants.some((g) => opensLesson(g, { id: lesson.id, month: lesson.month, term: lesson.unit.term }, now))) return "closed";
  }

  if (await isLimited(`practice:${userId}`, 50, 86_400_000)) return "limited";

  const replies: PracticeReply[] = items.map((item) => replyFrom(form, item.id));

  const score = scoreAttempt(items, replies);
  const progress = await awardPractice(userId, score.correct, items.length);

  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const group = groups.get(item.lessonId) ?? [];
    group.push(item);
    groups.set(item.lessonId, group);
  }

  const created: string[] = [];
  let xpLeft = progress?.xp ?? 0;
  for (const [lessonId, group] of groups) {
    // Mark each lesson from its own items; the whole set's XP lands on the first attempt so the leaderboard stays honest.
    const groupReplies = replies.filter((r) => group.some((i) => i.id === r.itemId));
    const groupScore = scoreAttempt(group, groupReplies);
    const attempt = await db.practiceAttempt.create({
      data: {
        userId,
        lessonId,
        marks: groupScore.marks,
        maxMarks: groupScore.maxMarks,
        xp: xpLeft,
        answers: {
          create: groupScore.results.map((r) => ({
            itemId: r.item.id,
            correct: r.correct,
            choiceId: r.item.kind === "MCQ" ? (groupReplies.find((x) => x.itemId === r.item.id)?.choiceId ?? null) : null,
            choiceIds: r.item.kind === "MULTI" ? (groupReplies.find((x) => x.itemId === r.item.id)?.choiceIds ?? []) : [],
            text: r.item.kind === "SHORT" ? (groupReplies.find((x) => x.itemId === r.item.id)?.text ?? null) : null,
          })),
        },
      },
      select: { id: true },
    });
    xpLeft = 0;
    created.push(attempt.id);
    await recordReview(userId, lessonId, groupScore.correct, group.length, now);
  }

  await recordAttempt(`practice:${userId}`);
  revalidatePath("/[locale]/dashboard", "page");
  redirect(`/review?attempts=${created.join(",")}`);
}
