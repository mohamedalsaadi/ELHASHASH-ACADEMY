// Spaced review. The ladder and the promotion rule are pure, so the tests and the action agree.
// Scheduled per lesson rather than per concept: questions hang off lessons, and no Concept rows exist yet.

/** 1 → 3 → 7 → 16 → 35 days. A miss sends the lesson back to the start. */
export const LADDER = [1, 3, 7, 16, 35] as const;

/** Four of five right keeps the lesson moving out; anything less brings it back tomorrow. */
export const PROMOTE_AT = 0.8;

export function nextReview(step: number, correct: number, total: number, now: Date) {
  const ratio = total > 0 ? correct / total : 0;
  const nextStep = ratio >= PROMOTE_AT ? Math.min(step + 1, LADDER.length - 1) : 0;
  const intervalDays = LADDER[nextStep];
  return { step: nextStep, intervalDays, dueAt: new Date(now.getTime() + intervalDays * 86_400_000) };
}

/** The rows that are due now, oldest first, capped so a backlog cannot turn into a wall. */
export function dueNow<T extends { dueAt: Date }>(rows: T[], now: Date, max = 5): T[] {
  return rows
    .filter((r) => r.dueAt <= now)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
    .slice(0, max);
}
