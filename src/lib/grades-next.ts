export type GradeStep = { id: string; countryId: string; curriculum: string; level: number; track: string; isTerminal: boolean; active: boolean };

/**
 * The grade a student moves to in August: the next level in the same country, curriculum and track.
 * null when there is none to move to (a terminal year, the top level, or the next level is not offered):
 * that student simply stays where they are.
 */
export function nextGrade<G extends GradeStep>(from: GradeStep, all: G[]): G | null {
  if (from.isTerminal) return null;
  return all.find((g) => g.active && g.countryId === from.countryId && g.curriculum === from.curriculum && g.track === from.track && g.level === from.level + 1) ?? null;
}
