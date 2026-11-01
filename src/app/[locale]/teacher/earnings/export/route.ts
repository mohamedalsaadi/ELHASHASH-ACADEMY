import { csvResponse } from "@/lib/csv";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/staff";

export const dynamic = "force-dynamic";

/** Every ledger row of the signed-in teacher, one line per sale or refund. Amounts are in minor units (fils, piastres). */
export async function GET() {
  const me = await requireStaff();
  const rows = await db.ledgerEntry.findMany({
    where: { instructorId: me.id },
    orderBy: { createdAt: "asc" },
    select: {
      createdAt: true,
      kind: true,
      orderId: true,
      currency: true,
      gross: true,
      net: true,
      platformFee: true,
      instructorNet: true,
      courseId: true,
    },
  });
  // The ledger keeps no foreign key to courses, so titles are looked up beside it.
  const courses = await db.course.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.courseId))] } }, select: { id: true, titleAr: true, titleEn: true } });
  const title = new Map(courses.map((c) => [c.id, c.titleEn || c.titleAr]));
  const lines: unknown[][] = [["date", "kind", "order", "course", "currency", "gross", "net", "platform_fee", "your_share"]];
  for (const r of rows)
    lines.push([r.createdAt.toISOString(), r.kind, r.orderId, title.get(r.courseId) ?? r.courseId, r.currency, r.gross, r.net, r.platformFee, r.instructorNet]);
  return csvResponse(lines, `earnings-${new Date().toISOString().slice(0, 10)}.csv`);
}
