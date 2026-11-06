import { auth } from "@/auth";
import { db } from "@/lib/db";
import { taxReportPdf } from "@/lib/pdf/documents";
import { defaultPeriod, isPeriod, loadTaxReport } from "@/lib/tax-report-data";

export async function GET(req: Request) {
  const session = await auth();
  const me = session?.user && (await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } }));
  if (me?.role !== "ADMIN") return new Response("Not found", { status: 404 });

  const requested = new URL(req.url).searchParams.get("period") ?? undefined;
  const period = isPeriod(requested) ? requested : defaultPeriod();
  const report = await loadTaxReport(period);
  const bytes = await taxReportPdf(period, report);

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="tax-${period}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
