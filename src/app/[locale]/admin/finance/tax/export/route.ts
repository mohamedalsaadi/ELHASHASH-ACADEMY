import { auth } from "@/auth";
import { csvResponse } from "@/lib/csv";
import { db } from "@/lib/db";
import { minorPerUnit } from "@/lib/format";
import type { Currency } from "@/lib/pricing-engine";
import { defaultPeriod, isPeriod, loadTaxReport } from "@/lib/tax-report-data";

/** One row per market and currency for the selected month. CSV is Excel-compatible and never sums across currencies. */
export async function GET(req: Request) {
  const session = await auth();
  const me = session?.user && (await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } }));
  if (me?.role !== "ADMIN") return new Response("Not found", { status: 404 });

  const requested = new URL(req.url).searchParams.get("period") ?? undefined;
  const period = isPeriod(requested) ? requested : defaultPeriod();
  const report = await loadTaxReport(period);

  const amount = (minor: number, currency: Currency) => {
    const per = minorPerUnit(currency);
    return (minor / per).toFixed(per === 1000 ? 3 : 2);
  };

  const rows: unknown[][] = [
    [
      "period",
      "country_code",
      "seller_trn",
      "currency",
      "sales_net_standard",
      "vat_output",
      "sales_net_zero",
      "credit_notes_net",
      "credit_notes_vat",
      "output_tax_due",
      "input_tax",
      "net_vat_due",
      "platform_fee",
      "platform_discount",
      "corporate_tax",
      "instructor_net",
      "orders",
      "refunds",
    ],
    ...report.map((r) => [
      r.period,
      r.countryCode,
      r.sellerTrn ?? "",
      r.currency,
      amount(r.salesNetStandard, r.currency),
      amount(r.vatOutput, r.currency),
      amount(r.salesNetZero, r.currency),
      amount(r.creditNotesNet, r.currency),
      amount(r.creditNotesVat, r.currency),
      amount(r.outputTaxDue, r.currency),
      "0",
      amount(r.netVatDue, r.currency),
      amount(r.platformFee, r.currency),
      amount(r.platformDiscount, r.currency),
      amount(r.corporateTax, r.currency),
      amount(r.instructorNet, r.currency),
      r.orders,
      r.refunds,
    ]),
  ];

  return csvResponse(rows, `tax-${period}.csv`);
}
