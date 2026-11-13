import { db } from "@/lib/db";
import { lessonEntries } from "@/lib/learning";
import { MIN_SHOWN, canRate } from "@/lib/review-eligibility";

export type Rating = { avg: number; count: number };

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Average and count of published reviews per course. Only a course with at least MIN_SHOWN of them gets an entry,
 * so a single opinion is never shown as "the" rating and nothing is shown for none.
 */
export async function courseRatings(courseIds: string[]): Promise<Map<string, Rating>> {
  if (courseIds.length === 0) return new Map();
  const rows = await db.courseReview.groupBy({ by: ["courseId"], where: { courseId: { in: courseIds }, status: "PUBLISHED" }, _avg: { stars: true }, _count: { _all: true } });
  return new Map(rows.filter((r) => r._count._all >= MIN_SHOWN).map((r) => [r.courseId, { avg: round1(r._avg.stars ?? 0), count: r._count._all }]));
}

/** The teacher's overall rating across all their courses' published reviews, or null below MIN_SHOWN. */
export async function teacherRating(instructorId: string): Promise<Rating | null> {
  const r = await db.courseReview.aggregate({ where: { status: "PUBLISHED", course: { instructorId } }, _avg: { stars: true }, _count: { _all: true } });
  return r._count._all >= MIN_SHOWN ? { avg: round1(r._avg.stars ?? 0), count: r._count._all } : null;
}

/** Whether this student may rate the course now, and what they already said. Refunded plans never count. */
export async function rateState(userId: string, courseId: string, now = new Date()) {
  const [units, grants, views, mine] = await Promise.all([
    db.unit.findMany({ where: { courseId }, orderBy: { order: "asc" }, select: { order: true, isFree: true, term: true, lessons: { orderBy: { order: "asc" }, select: { id: true, order: true, month: true } } } }),
    db.entitlement.findMany({
      where: { userId, courseId, OR: [{ orderId: null }, { order: { status: { not: "REFUNDED" } } }] },
      select: { accessType: true, lessonId: true, liveSessionId: true, term: true, month: true, startsAt: true, endsAt: true },
    }),
    db.lessonView.findMany({ where: { userId, completedAt: { not: null }, lesson: { unit: { courseId } } }, select: { lessonId: true } }),
    db.courseReview.findUnique({ where: { courseId_studentId: { courseId, studentId: userId } }, select: { stars: true, text: true, status: true } }),
  ]);
  const { eligible, pct } = canRate(lessonEntries(units), grants, new Set(views.map((v) => v.lessonId)), now);
  return { eligible, pct, mine };
}
