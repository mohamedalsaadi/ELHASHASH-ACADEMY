import type { Currency } from "@/lib/pricing-engine";

export type StatementRow = {
  createdAt: Date;
  currency: Currency;
  instructorId: string | null;
  gross: number;
  vat: number;
  net: number;
  platformFee: number;
  platformDiscount: number;
  corporateTax: number;
  instructorNet: number;
  instructorPayout: number;
};

export type StatementBucket = {
  instructorId: string;
  period: string;
  currency: Currency;
  salesCount: number;
  refundCount: number;
  gross: number;
  vat: number;
  net: number;
  platformFee: number;
  platformDiscount: number;
  corporateTax: number;
  instructorNet: number;
  instructorPayout: number;
};

/**
 * One statement per teacher and currency. A refund is a negative row, so it nets out and counts as
 * a refund rather than a sale. Rows with no instructor belong to the platform and are dropped.
 */
export function summarizeStatements(rows: StatementRow[], period: string): StatementBucket[] {
  const map = new Map<string, StatementBucket>();
  for (const r of rows) {
    if (!r.instructorId) continue;
    const key = `${r.instructorId}|${r.currency}`;
    const b =
      map.get(key) ??
      {
        instructorId: r.instructorId,
        period,
        currency: r.currency,
        salesCount: 0,
        refundCount: 0,
        gross: 0,
        vat: 0,
        net: 0,
        platformFee: 0,
        platformDiscount: 0,
        corporateTax: 0,
        instructorNet: 0,
        instructorPayout: 0,
      };
    if (r.gross >= 0) b.salesCount++;
    else b.refundCount++;
    b.gross += r.gross;
    b.vat += r.vat;
    b.net += r.net;
    b.platformFee += r.platformFee;
    b.platformDiscount += r.platformDiscount;
    b.corporateTax += r.corporateTax;
    b.instructorNet += r.instructorNet;
    b.instructorPayout += r.instructorPayout;
    map.set(key, b);
  }
  return [...map.values()];
}
