import { db } from "@/lib/db";

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

const active = (now: Date) => ({ startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] });

/** True when the user holds a whole-course subscription that is active at `now`. Lesson rentals don't count. */
export async function hasAccess(userId: string | undefined, courseId: string, now = new Date()) {
  if (!userId) return false;
  const count = await db.entitlement.count({ where: { userId, courseId, lessonId: null, ...active(now) } });
  return count > 0;
}

/** The user's lessons rented and still active at `now`, mapped to when each rental ends. */
export async function activeRentals(userId: string | undefined, courseId: string, now = new Date()) {
  if (!userId) return new Map<string, Date | null>();
  const rows = await db.entitlement.findMany({
    where: { userId, courseId, lessonId: { not: null }, ...active(now) },
    orderBy: { endsAt: "asc" },
    select: { lessonId: true, endsAt: true },
  });
  // ponytail: two overlapping rentals of one lesson show the later end; both stay valid either way.
  return new Map(rows.map((r) => [r.lessonId!, r.endsAt]));
}

/** True when a subscription or an active rental opens this lesson. */
export async function hasLessonAccess(userId: string | undefined, courseId: string, lessonId: string, now = new Date()) {
  if (!userId) return false;
  const count = await db.entitlement.count({
    where: { userId, courseId, AND: [{ OR: [{ lessonId: null }, { lessonId }] }, active(now)] },
  });
  return count > 0;
}

/** What a course card needs: the cheapest package on sale, whether a free unit exists, the grade and the teacher. */
export function cardInclude(now: Date) {
  return {
    skus: { where: { ...onSale(now), lessonId: null }, orderBy: { price: "asc" as const }, take: 1 },
    units: { where: { isFree: true }, select: { id: true }, take: 1 },
    grade: true,
    instructor: { select: { name: true, photoUrl: true } },
  };
}
