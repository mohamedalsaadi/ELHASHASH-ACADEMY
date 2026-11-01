import { describe, expect, it } from "vitest";
import { groupEarnings, monthKey, type EarningRow } from "./earnings";

const row = (iso: string, gross: number, net: number, currency: "AED" | "EGP" = "AED", courseId = "c1"): EarningRow => ({
  createdAt: new Date(iso),
  currency,
  courseId,
  gross,
  instructorNet: net,
});

describe("groupEarnings", () => {
  it("sums by month and keeps currencies apart", () => {
    const g = groupEarnings(
      [row("2026-10-03T10:00:00Z", 100, 70), row("2026-10-20T10:00:00Z", 200, 140), row("2026-10-21T10:00:00Z", 500, 350, "EGP"), row("2026-11-01T10:00:00Z", 100, 70)],
      (r) => monthKey(r.createdAt),
    );
    expect(g).toContainEqual({ key: "2026-10", currency: "AED", sales: 2, gross: 300, net: 210 });
    expect(g).toContainEqual({ key: "2026-10", currency: "EGP", sales: 1, gross: 500, net: 350 });
    expect(g).toContainEqual({ key: "2026-11", currency: "AED", sales: 1, gross: 100, net: 70 });
  });
  it("nets refunds out", () => {
    const [g] = groupEarnings([row("2026-10-03T10:00:00Z", 100, 70), row("2026-10-05T10:00:00Z", -100, -70)], (r) => r.courseId);
    expect(g).toEqual({ key: "c1", currency: "AED", sales: 0, gross: 0, net: 0 });
  });
});
