// Loads what the lesson gate needs for one student in one course (see gate.ts for the rule). Server only.
import { grantsFor } from "./catalog";
import { db } from "./db";
import { doneKey, firstBlocker, isLocked, type Blocker, type RequiredItem } from "./gate";
import { lessonEntries } from "./learning";

/** Handed in means submitted: a returned homework is not done, and an attempt still in progress is not done. */
const HANDED_IN = ["SUBMITTED", "GRADED"] as const;

export async function loadGate(learnerId: string, courseId: string, now = new Date()) {
  const [assignments, papers] = await Promise.all([
    db.assignment.findMany({ where: { courseId, required: true, lessonId: { not: null } }, select: { id: true, title: true, lessonId: true } }),
    db.examPaper.findMany({ where: { courseId, required: true, published: true, lessonId: { not: null } }, select: { id: true, title: true, lessonId: true } }),
  ]);
  const required: RequiredItem[] = [
    ...assignments.map((a) => ({ lessonId: a.lessonId!, kind: "assignment" as const, id: a.id, title: a.title })),
    ...papers.map((p) => ({ lessonId: p.lessonId!, kind: "exam" as const, id: p.id, title: p.title })),
  ];
  const units = await db.unit.findMany({ where: { courseId }, select: { order: true, isFree: true, term: true, lessons: { select: { id: true, order: true, month: true } } } });
  const entries = lessonEntries(units);
  if (required.length === 0) return { entries, blocker: null as Blocker | null };

  const [subs, attempts, grants] = await Promise.all([
    db.submission.findMany({ where: { studentId: learnerId, assignmentId: { in: assignments.map((a) => a.id) }, status: { in: [...HANDED_IN] } }, select: { assignmentId: true } }),
    db.examAttempt.findMany({ where: { userId: learnerId, paperId: { in: papers.map((p) => p.id) }, status: { in: [...HANDED_IN] } }, select: { paperId: true } }),
    grantsFor(learnerId, courseId, now),
  ]);
  const done = new Set([...subs.map((s) => doneKey("assignment", s.assignmentId)), ...attempts.map((a) => doneKey("exam", a.paperId))]);
  return { entries, blocker: firstBlocker(entries, grants, now, required, done) };
}

/** The work a student must hand in before this lesson opens, or null when it is open. Staff are never gated: callers skip this for them. */
export async function blockerFor(learnerId: string, courseId: string, lessonId: string, now = new Date()): Promise<RequiredItem | null> {
  const { entries, blocker } = await loadGate(learnerId, courseId, now);
  return isLocked(entries, blocker, lessonId) ? blocker!.item : null;
}

/** Where a student does a required item. */
export const itemHref = (slug: string, item: RequiredItem) => (item.kind === "exam" ? `/courses/${slug}/exams/${item.id}` : `/courses/${slug}/assignments/${item.id}`);
