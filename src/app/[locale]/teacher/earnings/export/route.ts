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
      corporateTax: true,
      instructorPayout: true,
      courseId: true,
      order: {
        select: {
          documents: {
            where: { kind: "INVOICE" },
            select: {
              number: true,
              acks: { where: { teacherId: me.id }, select: { acknowledgedAt: true } },
            },
          },
        },
      },
    },
  });
  // The ledger keeps no foreign key to courses, so titles are looked up beside it.
  const courses = await db.course.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.courseId))] } }, select: { id: true, titleAr: true, titleEn: true } });
  const title = new Map(courses.map((c) => [c.id, c.titleEn || c.titleAr]));
  const lines: unknown[][] = [
    [
      "date",
      "kind",
      "receipt_number",
      "receipt_acknowledged_at",
      "order",
      "course",
      "currency",
      "gross",
      "net",
      "platform_fee",
      "corporate_tax",
      "your_share",
      "paid_out",
    ],
  ];
  for (const r of rows) {
    const doc = r.order.documents[0];
    lines.push([
      r.createdAt.toISOString(),
      r.kind,
      doc?.number ?? "",
      doc?.acks[0]?.acknowledgedAt?.toISOString() ?? "",
      r.orderId,
      title.get(r.courseId) ?? r.courseId,
      r.currency,
      r.gross,
      r.net,
      r.platformFee,
      r.corporateTax,
      r.instructorNet,
      r.instructorPayout,
    ]);
  }
  return csvResponse(lines, `earnings-${new Date().toISOString().slice(0, 10)}.csv`);
}
