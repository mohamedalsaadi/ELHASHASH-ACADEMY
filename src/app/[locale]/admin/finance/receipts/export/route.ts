import { auth } from "@/auth";
import { csvResponse } from "@/lib/csv";
import { db } from "@/lib/db";
import { minorPerUnit } from "@/lib/format";
import { appUrl } from "@/lib/mail";
import { defaultPeriod, isPeriod } from "@/lib/tax-report-data";

/**
 * One row per issued document, with the receipt PDF URL on the row. CSV opens in Excel; the link is
 * the practical equivalent of an attachment, because a CSV cell cannot embed a file.
 */
export async function GET(req: Request) {
  const session = await auth();
  const me = session?.user && (await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } }));
  if (me?.role !== "ADMIN") return new Response("Not found", { status: 404 });

  const requested = new URL(req.url).searchParams.get("period") ?? undefined;
  const period = isPeriod(requested) ? requested : defaultPeriod();
  const [year, month] = period.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const docs = await db.document.findMany({
    where: { issuedAt: { gte: start, lt: end } },
    orderBy: { issuedAt: "asc" },
    select: {
      id: true,
      number: true,
      kind: true,
      issuedAt: true,
      orderId: true,
      currency: true,
      taxCountryCode: true,
      buyerName: true,
      buyerPhone: true,
      beneficiaryName: true,
      subtotal: true,
      discount: true,
      platformDiscount: true,
      vat: true,
      total: true,
      sellerTrn: true,
    },
  });

  const amount = (minor: number, currency: (typeof docs)[number]["currency"]) => {
    const per = minorPerUnit(currency);
    return (minor / per).toFixed(per === 1000 ? 3 : 2);
  };

  const rows: unknown[][] = [
    [
      "period",
      "receipt_number",
      "kind",
      "issued_at",
      "order_id",
      "buyer",
      "phone",
      "beneficiary",
      "country",
      "currency",
      "subtotal",
      "discount",
      "platform_discount",
      "vat",
      "total",
      "trn",
      "receipt_pdf_url",
    ],
    ...docs.map((d) => [
      period,
      d.number,
      d.kind,
      d.issuedAt.toISOString(),
      d.orderId,
      d.buyerName,
      d.buyerPhone ?? "",
      d.beneficiaryName ?? "",
      d.taxCountryCode ?? "",
      d.currency,
      amount(d.subtotal, d.currency),
      amount(d.discount, d.currency),
      amount(d.platformDiscount, d.currency),
      amount(d.vat, d.currency),
      amount(d.total, d.currency),
      d.sellerTrn ?? "",
      `${appUrl()}/api/documents/${d.id}/pdf`,
    ]),
  ];

  return csvResponse(rows, `receipts-${period}.csv`);
}
