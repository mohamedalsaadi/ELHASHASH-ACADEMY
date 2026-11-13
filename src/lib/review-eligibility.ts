import { courseProgress, type LessonEntry, type LessonNode } from "./learning";
import type { Grant } from "./plans";

/** A student may rate a course once they finished this share of the lessons their plan opens. */
export const RATE_AT_PCT = 70;
/** Or, once the plan has ended, this share. */
export const RATE_ENDED_AT_PCT = 30;
/** A rating is shown publicly only from this many published reviews (and never when there are none). */
export const MIN_SHOWN = 3;
/** One or two out of five waits for an admin before anyone sees it. */
export const HELD_AT_STARS = 2;

/**
 * Who may rate a course: a whole-course subscriber (not a single lecture or a seat in a live session) who is really taking it.
 * Progress is counted on what their plan covers even after it ended, so a finished plan still counts.
 */
export function canRate(entries: LessonEntry<LessonNode>[], grants: Grant[], completed: Set<string>, now: Date) {
  const whole = grants.filter((g) => !g.lessonId && !g.liveSessionId && g.startsAt <= now);
  if (whole.length === 0) return { eligible: false, pct: 0 };
  const pct = courseProgress(entries, whole.map((g) => ({ ...g, endsAt: null })), completed, now).pct;
  const ended = whole.every((g) => g.endsAt && g.endsAt <= now);
  return { eligible: pct >= RATE_AT_PCT || (ended && pct >= RATE_ENDED_AT_PCT), pct };
}
