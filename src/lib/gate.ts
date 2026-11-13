// The rule behind mandatory homework and exams: a lesson is closed while an earlier lesson, one the student can open,
// still has a required item they have not handed in. Pure, so every screen and route reads the same answer.
import { opens, type LessonEntry, type LessonNode } from "./learning";
import type { Grant } from "./plans";

export type RequiredItem = { lessonId: string; kind: "assignment" | "exam"; id: string; title: string };
export type Blocker = { index: number; item: RequiredItem };

export const doneKey = (kind: RequiredItem["kind"], id: string) => `${kind}:${id}`;

/**
 * The first lesson, in teaching order, that the student can open and that still has a required item not in `done`.
 * Lessons the plan does not open never block (the student could not do their work). Null means nothing is closed.
 */
export function firstBlocker<L extends LessonNode>(entries: LessonEntry<L>[], grants: Grant[], now: Date, required: RequiredItem[], done: Set<string>): Blocker | null {
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const item = required.find((r) => r.lessonId === entry.lesson.id && !done.has(doneKey(r.kind, r.id)));
    if (item && opens(entry, grants, now)) return { index, item };
  }
  return null;
}

/** A lesson is closed when it comes after the blocking lesson. The blocking lesson itself stays open: that is where the work is. */
export function isLocked<L extends LessonNode>(entries: LessonEntry<L>[], blocker: Blocker | null, lessonId: string): boolean {
  if (!blocker) return false;
  const at = entries.findIndex((e) => e.lesson.id === lessonId);
  return at > blocker.index;
}
