// How ready a student is for this course's exam, from what the platform actually recorded.
// No prediction of a grade the teacher has not given: this is a measure of the student's own
// coverage, practice accuracy, self-reported confidence and recent activity, and it says which
// unit is holding the number down. Pure: no database, so the maths is testable on its own.

export type Confidence = "GOT_IT" | "SHAKY" | "LOST";

export type ReadinessUnit = {
  id: string;
  title: string;
  /** Only the lessons the student can actually open in this unit. */
  lessonIds: string[];
};

export type ReadinessInput = {
  units: ReadinessUnit[];
  completed: Set<string>;
  confidence: Map<string, Confidence>;
  /** One entry per practice attempt, with the marks it scored. */
  attempts: { lessonId: string; marks: number; maxMarks: number }[];
  lastActivity: Date | null;
  now: Date;
};

export type ReadinessGap =
  | { kind: "accuracy"; unitId: string; title: string; accuracy: number }
  | { kind: "unfinished"; unitId: string; title: string; remaining: number };

export type Readiness = {
  /** 0–100. */
  score: number;
  /** Share of openable lessons finished, 0–1. */
  coverage: number;
  /** Share of practice marks earned, 0–1, or null when nothing has been attempted. */
  accuracy: number | null;
  /** Share of answered lessons marked "got it", 0–1, or null when none answered. */
  confidenceShare: number | null;
  /** 1 while active today, falling to 0 after two weeks quiet. Null with no activity at all. */
  recency: number | null;
  /** True when there is no practice yet, so the score is capped: watching is not readiness. */
  capped: boolean;
  gap: ReadinessGap | null;
};

const WEIGHT = { coverage: 35, accuracy: 35, confidence: 15, recency: 15 } as const;
const CAP_WITHOUT_PRACTICE = 55;
const RECENCY_DAYS = 14;
const MIN_ATTEMPTS_FOR_A_GAP = 3;
const GOOD_ENOUGH = 0.8;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function readiness(input: ReadinessInput): Readiness {
  const allLessons = input.units.flatMap((u) => u.lessonIds);
  const doneCount = allLessons.filter((id) => input.completed.has(id)).length;
  const coverage = allLessons.length ? doneCount / allLessons.length : 0;

  const marked = input.attempts.filter((a) => a.maxMarks > 0);
  const earned = marked.reduce((sum, a) => sum + a.marks, 0);
  const possible = marked.reduce((sum, a) => sum + a.maxMarks, 0);
  const accuracy = marked.length ? clamp01(earned / possible) : null;

  const answered = allLessons.filter((id) => input.confidence.has(id));
  const gotIt = answered.filter((id) => input.confidence.get(id) === "GOT_IT").length;
  const confidenceShare = answered.length ? gotIt / answered.length : null;

  const recency = input.lastActivity
    ? clamp01(1 - (input.now.getTime() - input.lastActivity.getTime()) / (RECENCY_DAYS * 86_400_000))
    : null;

  // Signals a student has not produced yet are left out and the weights renormalised, rather than
  // silently counting as zero: a new student is not "0% ready", they are simply unmeasured.
  const parts: { weight: number; value: number }[] = [{ weight: WEIGHT.coverage, value: coverage }];
  if (accuracy !== null) parts.push({ weight: WEIGHT.accuracy, value: accuracy });
  if (confidenceShare !== null) parts.push({ weight: WEIGHT.confidence, value: confidenceShare });
  if (recency !== null) parts.push({ weight: WEIGHT.recency, value: recency });

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  const raw = totalWeight ? (parts.reduce((sum, p) => sum + p.weight * p.value, 0) / totalWeight) * 100 : 0;
  const capped = accuracy === null;
  const score = Math.round(capped ? Math.min(raw, CAP_WITHOUT_PRACTICE) : raw);

  return { score, coverage, accuracy, confidenceShare, recency, capped, gap: findGap(input) };
}

function findGap(input: ReadinessInput): ReadinessGap | null {
  const unitOfLesson = new Map<string, ReadinessUnit>();
  for (const unit of input.units) for (const id of unit.lessonIds) unitOfLesson.set(id, unit);

  // Weakest unit that has enough practice to be worth naming.
  const perUnit = new Map<string, { earned: number; possible: number; count: number }>();
  for (const attempt of input.attempts) {
    if (attempt.maxMarks <= 0) continue;
    const unit = unitOfLesson.get(attempt.lessonId);
    if (!unit) continue;
    const row = perUnit.get(unit.id) ?? { earned: 0, possible: 0, count: 0 };
    row.earned += attempt.marks;
    row.possible += attempt.maxMarks;
    row.count += 1;
    perUnit.set(unit.id, row);
  }

  let weakest: { unit: ReadinessUnit; accuracy: number } | null = null;
  for (const [unitId, row] of perUnit) {
    if (row.count < MIN_ATTEMPTS_FOR_A_GAP || row.possible <= 0) continue;
    const unit = input.units.find((u) => u.id === unitId);
    if (!unit) continue;
    const accuracy = clamp01(row.earned / row.possible);
    if (accuracy >= GOOD_ENOUGH) continue;
    if (!weakest || accuracy < weakest.accuracy) weakest = { unit, accuracy };
  }
  if (weakest) return { kind: "accuracy", unitId: weakest.unit.id, title: weakest.unit.title, accuracy: weakest.accuracy };

  // Otherwise the unit with the most still-unfinished lessons.
  let unfinished: { unit: ReadinessUnit; remaining: number } | null = null;
  for (const unit of input.units) {
    const remaining = unit.lessonIds.filter((id) => !input.completed.has(id)).length;
    if (remaining === 0) continue;
    if (!unfinished || remaining > unfinished.remaining) unfinished = { unit, remaining };
  }
  return unfinished ? { kind: "unfinished", unitId: unfinished.unit.id, title: unfinished.unit.title, remaining: unfinished.remaining } : null;
}
