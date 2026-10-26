import { db } from "@/lib/db";
import { mayAsk, opensLesson, opensLive, type Grant, type LessonScope } from "@/lib/plans";

/** Prisma filter for SKUs that can be bought right now (same window rule as the pricing engine: [saleFrom, saleTo)). */
export function onSale(now: Date) {
  return {
    active: true,
    AND: [
      { OR: [{ saleFrom: null }, { saleFrom: { lte: now } }] },
      { OR: [{ saleTo: null }, { saleTo: { gt: now } }] },
    ],
  };
}

/** SKUs that sell the whole course or a plan of it: not a rented lesson, not a live seat. */
const wholeCourse = { lessonId: null, liveSessionId: null };

/** The user's entitlements in a course that haven't ended; the rules in plans.ts decide what each one opens.
    `includeEnded` lets a page tell a lapsed subscriber apart from a stranger. */
export async function grantsFor(
  userId: string | undefined,
  courseId: string,
  now = new Date(),
  opts: { includeEnded?: boolean } = {},
): Promise<Grant[]> {
  if (!userId) return [];
  return db.entitlement.findMany({
    where: {
      userId,
      courseId,
      ...(opts.includeEnded ? {} : { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }),
    },
    orderBy: { endsAt: "asc" },
    select: { accessType: true, lessonId: true, liveSessionId: true, term: true, month: true, startsAt: true, endsAt: true },
  });
}

/** Admins and the course's own teacher see a course the way its owner does. One rule for every screen. */
export function isCourseStaff(user: { id: string; role: string } | undefined, course: { instructorId: string }): boolean {
  return !!user && (user.role === "ADMIN" || course.instructorId === user.id);
}

/** A lesson as the plan rules see it. */
export const lessonScope = (l: { id: string; month: number | null; unit: { term: number } }): LessonScope => ({ id: l.id, month: l.month, term: l.unit.term });

/** True when a plan or a rental the user holds opens this lesson. */
export async function hasLessonAccess(userId: string | undefined, courseId: string, lesson: LessonScope, now = new Date()) {
  return (await grantsFor(userId, courseId, now)).some((g) => opensLesson(g, lesson, now));
}

/** True when the user may ask the teacher about this lesson. */
export async function canAsk(userId: string | undefined, courseId: string, lesson: LessonScope, now = new Date()) {
  return (await grantsFor(userId, courseId, now)).some((g) => mayAsk(g, lesson, now));
}

/**
 * Who may join a live session: its course's teacher and admins as hosts; as students, a seat holder or a
 * term-or-longer subscriber (plans.ts opensLive). Returns null for everyone else.
 */
export async function liveRole(
  user: { id: string; role: string } | undefined,
  session: { id: string; courseId: string; course: { instructorId: string } },
  now = new Date(),
): Promise<"host" | "student" | null> {
  if (!user) return null;
  if (isCourseStaff(user, session.course)) return "host";
  return (await grantsFor(user.id, session.courseId, now)).some((g) => opensLive(g, session.id, now)) ? "student" : null;
}

export type StageRow = { id: string; nameAr: string; nameEn: string; fromLevel: number; toLevel: number; order: number };

/** Groups grades by the owner-managed stage ranges; levels outside every range go in one trailing group. */
export function groupByStage<T extends { level: number }>(grades: T[], stages: readonly StageRow[]): { stage: StageRow | null; grades: T[] }[] {
  const ordered = [...stages].sort((a, b) => a.order - b.order);
  const groups = ordered.map((stage) => ({
    stage: stage as StageRow | null,
    grades: grades.filter((g) => g.level >= stage.fromLevel && g.level <= stage.toLevel),
  }));
  const other = grades.filter((g) => !ordered.some((s) => g.level >= s.fromLevel && g.level <= s.toLevel));
  if (other.length) groups.push({ stage: null, grades: other });
  return groups.filter((g) => g.grades.length > 0);
}

/** What a course card needs: the whole-course packages (the card picks the cheapest effective price), a free unit, the grade. */
export function cardInclude(now: Date) {
  return {
    skus: { where: { ...onSale(now), ...wholeCourse }, orderBy: { price: "asc" as const }, take: 10 },
    units: { where: { isFree: true }, select: { id: true }, take: 1 },
    grade: true,
  };
}
