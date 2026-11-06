import { describe, expect, it } from "vitest";
import { summarizeTax, type TaxLedgerRow } from "./tax-report";

const row = (over: Partial<TaxLedgerRow>): TaxLedgerRow => ({
  orderId: "o1",
  kind: "SALE",
  currency: "AED",
  countryCode: "AE",
  gross: 10_500,
  vat: 500,
  net: 10_000,
  platformFee: 3_000,
  platformDiscount: 0,
  corporateTax: 0,
  instructorNet: 7_000,
  ...over,
});

const trn = (code: string | null) => (code === "AE" ? "AE-TRN" : null);

describe("summarizeTax", () => {
  it("reports output VAT and the standard-rated net", () => {
    const [r] = summarizeTax([row({})], "2026-11", trn);
    expect(r).toMatchObject({ countryCode: "AE", sellerTrn: "AE-TRN", salesNetStandard: 10_000, vatOutput: 500, outputTaxDue: 500, netVatDue: 500, orders: 1 });
  });

  it("nets a credit note against output tax", () => {
    const refund = row({ orderId: "o1", kind: "REFUND", gross: -10_500, vat: -500, net: -10_000, platformFee: -3_000, instructorNet: -7_000 });
    const [r] = summarizeTax([row({}), refund], "2026-11", trn);
    expect(r.outputTaxDue).toBe(0);
    expect(r.creditNotesVat).toBe(-500);
    expect(r.refunds).toBe(1);
    expect(r.orders).toBe(1);
  });

  it("never merges currencies or markets", () => {
    const rows = [row({}), row({ currency: "EGP", countryCode: "EG", vat: 0, gross: 100_000, net: 100_000 })];
    const report = summarizeTax(rows, "2026-11", trn);
    expect(report).toHaveLength(2);
    expect(report.find((r) => r.currency === "EGP")?.salesNetZero).toBe(100_000);
  });
});
