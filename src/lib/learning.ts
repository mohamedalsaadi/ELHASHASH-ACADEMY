// Shared learning maths: lesson order, progress and live-session phases. Pure, so the pages and the
// tests agree on what "open", "next" and "live now" mean. Nothing here invents data.
import { opensLesson, type Grant } from "./plans";

/** How long before the start a room can be entered. Students and hosts differ; every screen reads this. */
export const LIVE_LEAD_MIN = { student: 10, host: 30 } as const;

export type LessonNode = { id: string; order: number; month: number | null };
export type UnitNode<L extends LessonNode> = { order: number; isFree: boolean; term: number; lessons: L[] };
export type LessonEntry<L extends LessonNode> = { lesson: L; term: number; isFree: boolean };

/** Every lesson, unit by unit, in teaching order. */
export function lessonEntries<L extends LessonNode>(units: UnitNode<L>[]): LessonEntry<L>[] {
  return [...units]
    .sort((a, b) => a.order - b.order)
    .flatMap((u) =>
      [...u.lessons].sort((a, b) => a.order - b.order).map((lesson) => ({ lesson, term: u.term, isFree: u.isFree })),
    );
}

export function orderedLessons<L extends LessonNode>(units: UnitNode<L>[]): L[] {
  return lessonEntries(units).map((e) => e.lesson);
}

export function neighbours<L extends { id: string }>(ordered: L[], id: string): { prev?: L; next?: L } {
  const i = ordered.findIndex((l) => l.id === id);
  if (i < 0) return {};
  return { prev: ordered[i - 1], next: ordered[i + 1] };
}

export function opens(entry: LessonEntry<LessonNode>, grants: Grant[], now: Date): boolean {
  if (entry.isFree) return true;
  return grants.some((g) => opensLesson(g, { id: entry.lesson.id, month: entry.lesson.month, term: entry.term }, now));
}

/**
 * `total` counts only lessons this student can open, so a monthly plan does not read as 12% of a course.
 * `all` and `doneAll` are the course-wide figures, for the summary tile and the "opens X of Y" note.
 */
export function courseProgress(entries: LessonEntry<LessonNode>[], grants: Grant[], completed: Set<string>, now: Date) {
  let all = 0;
  let total = 0;
  let done = 0;
  let doneAll = 0;
  for (const entry of entries) {
    all += 1;
    const isDone = completed.has(entry.lesson.id);
    if (isDone) doneAll += 1;
    if (opens(entry, grants, now)) {
      total += 1;
      if (isDone) done += 1;
    }
  }
  return { done, total, all, doneAll, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** The next lesson the student can open and has not finished, in teaching order. */
export function nextOpenLesson<L extends LessonNode>(
  entries: LessonEntry<L>[],
  grants: Grant[],
  completed: Set<string>,
  now: Date,
  fromId?: string,
): LessonEntry<L> | undefined {
  const start = fromId ? entries.findIndex((e) => e.lesson.id === fromId) + 1 : 0;
  return entries.slice(start).find((e) => !completed.has(e.lesson.id) && opens(e, grants, now));
}

export type LivePhase = "now" | "soon" | "later" | "ended";

const SOON_MS = 2 * 60 * 60 * 1000;

export function livePhase(startsAt: Date, durationMin: number, now: Date): LivePhase {
  const start = startsAt.getTime();
  const end = start + durationMin * 60_000;
  if (now.getTime() >= end) return "ended";
  if (now.getTime() >= start) return "now";
  return start - now.getTime() <= SOON_MS ? "soon" : "later";
}

export function roomOpensAt(startsAt: Date, leadMin: number): Date {
  return new Date(startsAt.getTime() - leadMin * 60_000);
}

/** Split upcoming sessions into now / within two hours / later, dropping the ones that have ended. */
export function groupLive<T extends { startsAt: Date; durationMin: number }>(sessions: T[], now: Date) {
  const out: { now: T[]; soon: T[]; later: T[] } = { now: [], soon: [], later: [] };
  for (const s of sessions) {
    const phase = livePhase(s.startsAt, s.durationMin, now);
    if (phase !== "ended") out[phase].push(s);
  }
  return out;
}
