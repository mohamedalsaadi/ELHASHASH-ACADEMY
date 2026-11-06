import type { Currency } from "@/lib/pricing-engine";

export type TaxLedgerRow = {
  orderId: string;
  kind: "SALE" | "REFUND";
  currency: Currency;
  countryCode: string | null;
  gross: number;
  vat: number;
  net: number;
  platformFee: number;
  platformDiscount: number;
  corporateTax: number;
  instructorNet: number;
};

export type TaxReportRow = {
  period: string;
  countryCode: string;
  sellerTrn: string | null;
  currency: Currency;
  salesNetStandard: number;
  vatOutput: number;
  salesNetZero: number;
  creditNotesNet: number;
  creditNotesVat: number;
  outputTaxDue: number;
  netVatDue: number;
  platformFee: number;
  platformDiscount: number;
  corporateTax: number;
  instructorNet: number;
  orders: number;
  refunds: number;
};

/**
 * VAT201-style summary per market and currency. Amounts are never summed across currencies because
 * there is no FX conversion in the ledger. Input tax is zero: platform costs are not recorded here.
 */
export function summarizeTax(rows: TaxLedgerRow[], period: string, trnOf: (countryCode: string | null) => string | null): TaxReportRow[] {
  const map = new Map<string, TaxReportRow & { orderIds: Set<string>; refundIds: Set<string> }>();
  for (const r of rows) {
    const countryCode = r.countryCode ?? "GL";
    const key = `${countryCode}|${r.currency}`;
    const row =
      map.get(key) ??
      {
        period,
        countryCode,
        sellerTrn: trnOf(r.countryCode),
        currency: r.currency,
        salesNetStandard: 0,
        vatOutput: 0,
        salesNetZero: 0,
        creditNotesNet: 0,
        creditNotesVat: 0,
        outputTaxDue: 0,
        netVatDue: 0,
        platformFee: 0,
        platformDiscount: 0,
        corporateTax: 0,
        instructorNet: 0,
        orders: 0,
        refunds: 0,
        orderIds: new Set<string>(),
        refundIds: new Set<string>(),
      };
    if (r.kind === "SALE") {
      row.orderIds.add(r.orderId);
      if (r.vat > 0) row.salesNetStandard += r.net;
      else row.salesNetZero += r.net;
      row.vatOutput += r.vat;
    } else {
      row.refundIds.add(r.orderId);
      row.creditNotesNet += r.net;
      row.creditNotesVat += r.vat;
    }
    row.platformFee += r.platformFee;
    row.platformDiscount += r.platformDiscount;
    row.corporateTax += r.corporateTax;
    row.instructorNet += r.instructorNet;
    map.set(key, row);
  }
  return [...map.values()].map((r) => {
    const outputTaxDue = r.vatOutput + r.creditNotesVat;
    return {
      ...r,
      outputTaxDue,
      netVatDue: outputTaxDue,
      orders: r.orderIds.size,
      refunds: r.refundIds.size,
    };
  });
}
