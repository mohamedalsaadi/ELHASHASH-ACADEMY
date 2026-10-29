// Exam marking. Objective items mark themselves; a written answer is left null for the teacher.
import type { PracticeItem, PracticeReply } from "./practice";
import { gradeItem } from "./practice";

export type ExamItemLike = PracticeItem;

/** A submit that lands just after the clock still counts: phones, tunnels and slow taps are not cheating. */
export const SUBMIT_GRACE_MS = 60_000;

export function isExpired(expiresAt: Date, now: Date, graceMs = SUBMIT_GRACE_MS): boolean {
  return now.getTime() > expiresAt.getTime() + graceMs;
}

/**
 * Marks what can be marked. `needsGrading` is true when at least one written answer is waiting, which keeps
 * the attempt in SUBMITTED rather than GRADED until a teacher has seen it.
 */
export function markExam(items: ExamItemLike[], replies: PracticeReply[]) {
  const byItem = new Map(replies.map((r) => [r.itemId, r]));
  const results = items.map((item) => {
    const reply = byItem.get(item.id);
    if (item.kind === "WRITTEN") return { itemId: item.id, correct: null, marks: null };
    const graded = gradeItem(item, reply);
    return { itemId: item.id, correct: graded.correct, marks: graded.marks };
  });
  return {
    results,
    autoMarks: results.reduce((sum, r) => sum + (r.marks ?? 0), 0),
    maxMarks: items.reduce((sum, i) => sum + i.marks, 0),
    needsGrading: results.some((r) => r.correct === null),
  };
}
