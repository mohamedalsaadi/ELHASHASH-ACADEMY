// XP and streaks. Pure maths only; the database write lives in progress-db.ts so this file stays testable.

export const XP_PER_CORRECT = 2;
export const XP_COMPLETION = 5;

/** A finished set is worth something even when every answer is wrong — the effort counts. */
export function practiceXp(correct: number, total: number): number {
  return total > 0 ? correct * XP_PER_CORRECT + XP_COMPLETION : 0;
}

const dayKey = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/**
 * A streak counts days, not sessions: practising twice today adds nothing, practising yesterday keeps it
 * alive, and a missed day starts again at one.
 */
export function nextStreak(lastActive: Date | null, current: number, now: Date): { streak: number; counted: boolean } {
  if (!lastActive) return { streak: 1, counted: true };
  const days = Math.round((dayKey(now) - dayKey(lastActive)) / 86_400_000);
  if (days <= 0) return { streak: Math.max(1, current), counted: false };
  if (days === 1) return { streak: Math.max(1, current) + 1, counted: true };
  return { streak: 1, counted: true };
}

