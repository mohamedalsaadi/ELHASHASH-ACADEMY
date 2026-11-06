import { db } from "@/lib/db";
import { getFinanceConfig } from "@/lib/platform-settings";
import { summarizeTax } from "@/lib/tax-report";

export function defaultPeriod(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
}

export function isPeriod(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value));
}

/** The ledger rows for one UTC month, summarised by market and currency. */
export async function loadTaxReport(period: string) {
  const [year, month] = period.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const [rows, countries, cfg] = await Promise.all([
    db.ledgerEntry.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: {
        orderId: true,
        kind: true,
        currency: true,
        gross: true,
        vat: true,
        net: true,
        platformFee: true,
        platformDiscount: true,
        corporateTax: true,
        instructorNet: true,
        order: { select: { taxCountryCode: true } },
      },
    }),
    db.country.findMany({ select: { code: true, vatTrn: true } }),
    getFinanceConfig(),
  ]);
  const trns = new Map(countries.map((c) => [c.code, c.vatTrn]));
  return summarizeTax(
    rows.map((r) => ({ ...r, countryCode: r.order.taxCountryCode })),
    period,
    (code) => (code ? trns.get(code) ?? null : cfg.vatTrn),
  );
}
