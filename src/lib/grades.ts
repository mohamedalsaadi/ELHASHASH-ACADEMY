// Grading maths. Pure, so every dashboard shows the same figure from the same rule, and only graded
// scores ever enter a number. Nothing here guesses: a thin sample returns null, never a verdict.

/** One graded score, normalised against its assignment's maximum. */
export type Score = { value: number; max: number; unitId?: string | null };

export type UnitScore = { unitId: string; avg: number; n: number };

/** 0-100, rounded. The only way raw marks become a comparable number. */
export function toPercent(score: Score): number {
  if (!score.max || score.max <= 0) return 0;
  return Math.round((Math.max(0, Math.min(score.value, score.max)) * 100) / score.max);
}

/** Mean of the given scores, with its sample size. Null when there is nothing to average. */
export function average(scores: Score[]): { avg: number; n: number } | null {
  if (scores.length === 0) return null;
  const total = scores.reduce((sum, s) => sum + toPercent(s), 0);
  return { avg: Math.round(total / scores.length), n: scores.length };
}

/**
 * Averages per unit, strongest first. Units with fewer than `min` graded scores are dropped: two marks are
 * not a pattern, and naming a weakness from them would be a guess.
 */
export function byUnit(scores: Score[], min = 3): UnitScore[] {
  const groups = new Map<string, number[]>();
  for (const s of scores) {
    if (!s.unitId) continue;
    const list = groups.get(s.unitId) ?? [];
    list.push(toPercent(s));
    groups.set(s.unitId, list);
  }
  return [...groups.entries()]
    .filter(([, values]) => values.length >= min)
    .map(([unitId, values]) => ({
      unitId,
      avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      n: values.length,
    }))
    .sort((a, b) => b.avg - a.avg);
}

/** The best and worst unit, only when both ends have enough marks to mean something. */
export function strengths(scores: Score[], min = 3): { strongest: UnitScore; weakest: UnitScore } | null {
  const units = byUnit(scores, min);
  if (units.length < 2) return null;
  return { strongest: units[0], weakest: units[units.length - 1] };
}

export type Tier = "excellent" | "veryGood" | "good" | "pass" | "poor";

/** DESIGN.md §2: the Egyptian grade tiers, applied to a 0-100 percentage. */
export function tierOf(percent: number): Tier {
  if (percent >= 85) return "excellent";
  if (percent >= 75) return "veryGood";
  if (percent >= 65) return "good";
  if (percent >= 50) return "pass";
  return "poor";
}

/** Late and overdue are derived, never stored, so moving a deadline tells the truth. */
export function isLate(submittedAt: Date, dueAt: Date | null): boolean {
  return !!dueAt && submittedAt > dueAt;
}

export function isOverdue(submitted: boolean, dueAt: Date | null, now: Date): boolean {
  return !submitted && !!dueAt && dueAt < now;
}
