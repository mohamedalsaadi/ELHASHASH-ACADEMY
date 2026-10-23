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
