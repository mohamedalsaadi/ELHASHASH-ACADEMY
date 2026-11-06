import { describe, expect, it } from "vitest";
import { summarizeStatements, type StatementRow } from "./statements";

const row = (over: Partial<StatementRow>): StatementRow => ({
  createdAt: new Date("2026-11-03T10:00:00Z"),
  currency: "AED",
  instructorId: "t1",
  gross: 10_500,
  vat: 500,
  net: 10_000,
  platformFee: 3_000,
  platformDiscount: 0,
  corporateTax: 0,
  instructorNet: 7_000,
  instructorPayout: 7_000,
  ...over,
});

describe("summarizeStatements", () => {
  it("keeps teachers and currencies apart", () => {
    const buckets = summarizeStatements(
      [row({}), row({ instructorId: "t2" }), row({ currency: "EGP", gross: 105_000, vat: 5_000, net: 100_000, platformFee: 30_000, instructorNet: 70_000, instructorPayout: 70_000 })],
      "2026-11",
    );
    expect(buckets).toHaveLength(3);
    expect(buckets.find((b) => b.instructorId === "t1" && b.currency === "AED")?.instructorPayout).toBe(7_000);
    expect(buckets.find((b) => b.currency === "EGP")?.instructorPayout).toBe(70_000);
  });

  it("nets a refund against the sale and counts it as a refund", () => {
    const refund = row({ gross: -10_500, vat: -500, net: -10_000, platformFee: -3_000, instructorNet: -7_000, instructorPayout: -7_000 });
    const [b] = summarizeStatements([row({}), refund], "2026-11");
    expect(b.salesCount).toBe(1);
    expect(b.refundCount).toBe(1);
    expect(b.gross).toBe(0);
    expect(b.instructorPayout).toBe(0);
  });

  it("drops rows with no instructor", () => {
    expect(summarizeStatements([row({ instructorId: null })], "2026-11")).toEqual([]);
  });
});
