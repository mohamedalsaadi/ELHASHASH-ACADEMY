import { auth } from "@/auth";
import { db } from "@/lib/db";
import { statementPdf } from "@/lib/pdf/documents";
import type { Currency } from "@/lib/pricing-engine";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response(null, { status: 404 });
  const { id } = await params;
  const statement = await db.teacherStatement.findUnique({
    where: { id },
    include: { instructor: { select: { name: true } } },
  });
  if (!statement) return new Response(null, { status: 404 });
  if (statement.instructorId !== session.user.id && session.user.role !== "ADMIN") return new Response(null, { status: 404 });

  const bytes = await statementPdf({
    number: statement.number,
    period: statement.period,
    currency: statement.currency as Currency,
    teacherName: statement.instructor.name,
    salesCount: statement.salesCount,
    refundCount: statement.refundCount,
    gross: statement.gross,
    vat: statement.vat,
    net: statement.net,
    platformFee: statement.platformFee,
    platformDiscount: statement.platformDiscount,
    corporateTax: statement.corporateTax,
    instructorNet: statement.instructorNet,
    instructorPayout: statement.instructorPayout,
  });

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${statement.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
