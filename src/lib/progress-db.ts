// The only place StudentProgress is written.
import { db } from "./db";
import { nextStreak, practiceXp } from "./progress";

/**
 * Adds XP and advances the streak in one write.
 * Returns the XP **earned by this attempt**, not the running total: the attempt row stores it and the
 * leaderboard sums those rows, so a cumulative value there would count earlier XP again on every run.
 */
export async function awardPractice(userId: string, correct: number, total: number) {
  const xp = practiceXp(correct, total);
  if (xp <= 0) return null;
  const now = new Date();
  const row = await db.studentProgress.findUnique({ where: { userId }, select: { currentStreak: true, longestStreak: true, lastActiveDate: true } });
  const { streak } = nextStreak(row?.lastActiveDate ?? null, row?.currentStreak ?? 0, now);
  const longest = Math.max(row?.longestStreak ?? 0, streak);

  const saved = await db.studentProgress.upsert({
    where: { userId },
    create: { userId, xp, currentStreak: streak, longestStreak: longest, lastActiveDate: now },
    update: { xp: { increment: xp }, currentStreak: streak, longestStreak: longest, lastActiveDate: now },
  });
  return { xp, streak: saved.currentStreak };
}
