import { describe, expect, it } from "vitest";
import { average, byUnit, isLate, isOverdue, strengths, tierOf, toPercent } from "./grades";

const score = (value: number, max = 100, unitId?: string) => ({ value, max, unitId });

describe("toPercent", () => {
  it("normalises against the assignment maximum", () => {
    expect(toPercent(score(8, 10))).toBe(80);
    expect(toPercent(score(45, 50))).toBe(90);
  });

  it("clamps and survives a zero maximum", () => {
    expect(toPercent(score(120, 100))).toBe(100);
    expect(toPercent(score(-5, 100))).toBe(0);
    expect(toPercent(score(5, 0))).toBe(0);
  });
});

describe("average", () => {
  it("returns null rather than a fake zero", () => {
    expect(average([])).toBeNull();
  });

  it("averages percentages, not raw marks", () => {
    expect(average([score(8, 10), score(50, 100)])).toEqual({ avg: 65, n: 2 });
  });
});

describe("byUnit", () => {
  it("drops units without enough graded work", () => {
    const scores = [score(90, 100, "u1"), score(80, 100, "u1"), score(70, 100, "u2")];
    expect(byUnit(scores, 2)).toEqual([{ unitId: "u1", avg: 85, n: 2 }]);
    expect(byUnit(scores, 3)).toEqual([]);
  });

  it("sorts strongest first and ignores course-level scores", () => {
    const scores = [
      score(50, 100, "weak"),
      score(50, 100, "weak"),
      score(90, 100, "strong"),
      score(90, 100, "strong"),
      score(10, 100),
    ];
    expect(byUnit(scores, 2).map((u) => u.unitId)).toEqual(["strong", "weak"]);
  });
});

describe("strengths", () => {
  it("needs two qualifying units before naming anything", () => {
    expect(strengths([score(90, 100, "a"), score(90, 100, "a"), score(90, 100, "a")], 3)).toBeNull();
  });

  it("names the best and worst when both have three marks", () => {
    const scores = [
      ...[95, 90, 92].map((v) => score(v, 100, "a")),
      ...[40, 45, 50].map((v) => score(v, 100, "b")),
      ...[70, 72, 68].map((v) => score(v, 100, "c")),
    ];
    const s = strengths(scores, 3);
    expect(s?.strongest.unitId).toBe("a");
    expect(s?.weakest.unitId).toBe("b");
  });
});

describe("tiers and lateness", () => {
  it("maps the DESIGN.md tiers", () => {
    expect([100, 85, 84, 75, 74, 65, 64, 50, 49].map(tierOf)).toEqual([
      "excellent",
      "excellent",
      "veryGood",
      "veryGood",
      "good",
      "good",
      "pass",
      "pass",
      "poor",
    ]);
  });

  it("derives late and overdue from dates", () => {
    const due = new Date("2026-10-30T12:00:00Z");
    expect(isLate(new Date("2026-10-30T12:00:01Z"), due)).toBe(true);
    expect(isLate(new Date("2026-10-30T11:59:59Z"), due)).toBe(false);
    expect(isLate(new Date(), null)).toBe(false);
    expect(isOverdue(false, due, new Date("2026-10-31T00:00:00Z"))).toBe(true);
    expect(isOverdue(true, due, new Date("2026-10-31T00:00:00Z"))).toBe(false);
    expect(isOverdue(false, null, new Date())).toBe(false);
  });
});
