// The three plans' rules, pure so every page and the tests share them:
// a single lecture (RENTAL), one month (MONTHLY), one term (SEMESTER). Older whole-course plans open everything.
import type { AccessType } from "./pricing-engine";

/** An entitlement, with the plan scope copied from its SKU at payment. */
export type Grant = {
  accessType: AccessType | null;
  lessonId: string | null;
  liveSessionId: string | null;
  term: number | null;
  month: number | null;
  startsAt: Date;
  endsAt: Date | null;
};
export type LessonScope = { id: string; month: number | null; term: number };

const current = (g: Grant, now: Date) => g.startsAt <= now && (!g.endsAt || g.endsAt > now);

export function opensLesson(g: Grant, lesson: LessonScope, now: Date): boolean {
  if (!current(g, now) || g.liveSessionId) return false;
  if (g.lessonId) return g.lessonId === lesson.id;
  if (g.accessType === "MONTHLY") return g.month !== null && g.month === lesson.month;
  if (g.accessType === "SEMESTER" && g.term !== null) return g.term === lesson.term;
  return true;
}

/** Live sessions come with a seat in that session or a term or longer plan; never with a month or a single lecture. */
export function opensLive(g: Grant, sessionId: string, now: Date): boolean {
  if (!current(g, now)) return false;
  if (g.liveSessionId) return g.liveSessionId === sessionId;
  return !g.lessonId && g.accessType !== "MONTHLY";
}

/** Subscribers ask about lectures their plan opens; a single rented lecture doesn't include questions. */
export function mayAsk(g: Grant, lesson: LessonScope, now: Date): boolean {
  return !g.lessonId && opensLesson(g, lesson, now);
}

/** Price per lecture, and the saving against renting each lecture at `single`; null with no lectures to divide by. */
export function planValue(price: number, lectures: number, single: number | null) {
  if (lectures <= 0) return null;
  return {
    perLecture: Math.round(price / lectures),
    savePct: single ? Math.round((1 - price / (single * lectures)) * 100) : null,
  };
}

/** How many paid lectures a plan opens (free units are open to everyone anyway). */
export function lecturesIn(
  units: { isFree: boolean; term: number; lessons: { month: number | null }[] }[],
  sku: { accessType: AccessType; term: number | null; month: number | null },
) {
  return units
    .filter((u) => !u.isFree && (sku.accessType !== "SEMESTER" || sku.term === null || u.term === sku.term))
    .flatMap((u) => u.lessons)
    .filter((l) => sku.accessType !== "MONTHLY" || l.month === sku.month).length;
}
