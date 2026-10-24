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

/** True when the user holds an entitlement to the course that is active at `now`. */
export async function hasAccess(userId: string | undefined, courseId: string, now = new Date()) {
  if (!userId) return false;
  const count = await db.entitlement.count({
    where: { userId, courseId, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
  });
  return count > 0;
}

/** What a course card needs: the cheapest package on sale, whether a free unit exists, the grade and the teacher. */
export function cardInclude(now: Date) {
  return {
    skus: { where: onSale(now), orderBy: { price: "asc" as const }, take: 1 },
    units: { where: { isFree: true }, select: { id: true }, take: 1 },
    grade: true,
    instructor: { select: { name: true, photoUrl: true } },
  };
}
