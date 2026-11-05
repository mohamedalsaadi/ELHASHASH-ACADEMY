// Who may open an assignment. Kept pure so the pages, the actions and the file routes share one rule.
import type { Grant } from "./plans";
import { opensLesson } from "./plans";

/** The shape an assignment needs: its course, and its lesson when it is attached to one. */
export type AssignmentScope = {
  courseId: string;
  lesson: { id: string; month: number | null; unit: { term: number; isFree: boolean } } | null;
};

/**
 * A lesson-attached assignment follows the lesson's own rule, so a single-lecture rental opens that lesson's
 * homework. A course-level assignment needs a plan (not a rental) that is still running.
 */
export function opensAssignment(a: AssignmentScope, grants: Grant[], now: Date): boolean {
  if (a.lesson) {
    if (a.lesson.unit.isFree) return true;
    const scope = { id: a.lesson.id, month: a.lesson.month, term: a.lesson.unit.term };
    return grants.some((g) => opensLesson(g, scope, now));
  }
  return grants.some((g) => !g.lessonId && !g.liveSessionId && (!g.endsAt || g.endsAt > now));
}

/**
 * A whole-course subscription that is running **now**: not a rental, not a live seat, already
 * started, and not ended. The start check matters — a plan bought for next term must not open
 * course-level work early.
 */
export function hasPlan(grants: Grant[], now: Date): boolean {
  return grants.some((g) => !g.lessonId && !g.liveSessionId && g.startsAt <= now && (!g.endsAt || g.endsAt > now));
}
