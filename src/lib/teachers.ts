import { db } from "@/lib/db";
import { earningsByCurrency } from "@/lib/earnings";

/** A teacher's numbers for the back office: lessons they recorded, students with open access, and this month's earnings. */
export async function teacherStats(id: string, now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [lessons, students, sold] = await Promise.all([
    // A lesson without its own teacher was recorded by the course's.
    db.lesson.count({ where: { OR: [{ instructorId: id }, { instructorId: null, unit: { course: { instructorId: id } } }] } }),
    db.entitlement.findMany({
      where: { course: { instructorId: id }, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      distinct: ["userId"],
      select: { userId: true },
    }),
    db.orderItem.findMany({
      where: { sku: { course: { instructorId: id } }, order: { status: "PAID", paidAt: { gte: monthStart } } },
      select: { price: true, order: { select: { subtotal: true, total: true, currency: true } } },
    }),
  ]);
  return { lessons, students: students.length, earnings: earningsByCurrency(sold) };
}
