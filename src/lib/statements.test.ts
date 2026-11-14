import { describe, expect, it } from "vitest";
import { payableOn, statementCutoff, statementStart, summarizeStatements, type StatementRow } from "./statements";

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

describe("statement windows", () => {
  it("holds sales back for 14 days before the 1st", () => {
    expect(statementCutoff(new Date("2026-12-01T04:17:00Z")).toISOString()).toBe("2026-11-17T00:00:00.000Z");
  });
  it("pays on the 10th of the issue month", () => {
    expect(payableOn(new Date("2026-12-01T04:17:00Z")).toISOString()).toBe("2026-12-10T00:00:00.000Z");
  });
  it("starts where the last statement ended, or at the end of an old calendar month", () => {
    expect(statementStart(null).getTime()).toBe(0);
    expect(statementStart({ period: "2026-10", coversTo: null }).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(statementStart({ period: "2026-11", coversTo: new Date("2026-11-17T00:00:00Z") }).toISOString()).toBe("2026-11-17T00:00:00.000Z");
  });
  it("covers every sale exactly once across two statements", () => {
    const first = statementCutoff(new Date("2026-12-01T04:17:00Z"));
    const second = statementCutoff(new Date("2027-01-01T04:17:00Z"));
    const at = new Date("2026-11-20T00:00:00Z");
    const inFirst = at >= statementStart({ period: "2026-10", coversTo: null }) && at < first;
    const inSecond = at >= first && at < second;
    expect([inFirst, inSecond]).toEqual([false, true]);
  });
});
