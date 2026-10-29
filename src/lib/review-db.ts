// The only place ReviewSchedule is written. A practice run, single or mixed, feeds it.
import { db } from "./db";
import { nextReview } from "./review";

/**
 * Records one review of a lesson and returns when it comes back. A first run starts from step -1, so even a
 * perfect first attempt returns tomorrow rather than skipping straight to the end of the ladder.
 */
export async function recordReview(userId: string, lessonId: string, correct: number, total: number, now = new Date()) {
  const row = await db.reviewSchedule.findUnique({ where: { userId_lessonId: { userId, lessonId } }, select: { step: true } });
  const next = nextReview(row?.step ?? -1, correct, total, now);
  return db.reviewSchedule.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, dueAt: next.dueAt, step: next.step, intervalDays: next.intervalDays, reviews: 1, lastReviewedAt: now },
    update: { dueAt: next.dueAt, step: next.step, intervalDays: next.intervalDays, reviews: { increment: 1 }, lastReviewedAt: now },
  });
}
