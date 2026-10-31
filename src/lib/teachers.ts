import { db } from "@/lib/db";
import type { Currency } from "@/lib/pricing-engine";

/**
 * A teacher's numbers for the back office: lessons they recorded, students with open access,
 * and this month's net earnings taken from the ledger (refunds already netted out).
 */
export async function teacherStats(id: string, now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [lessons, students, ledger] = await Promise.all([
    // A lesson without its own teacher was recorded by the course's.
    db.lesson.count({ where: { OR: [{ instructorId: id }, { instructorId: null, unit: { course: { instructorId: id } } }] } }),
    db.entitlement.findMany({
      where: { course: { instructorId: id }, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      distinct: ["userId"],
      select: { userId: true },
    }),
    db.ledgerEntry.findMany({
      where: { instructorId: id, createdAt: { gte: monthStart } },
      select: { instructorNet: true, currency: true },
    }),
  ]);

  const earnings = new Map<Currency, number>();
  for (const e of ledger) earnings.set(e.currency, (earnings.get(e.currency) ?? 0) + e.instructorNet);

  return { lessons, students: students.length, earnings };
}
