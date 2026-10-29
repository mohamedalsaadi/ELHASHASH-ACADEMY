import { describe, expect, it } from "vitest";
import { LADDER, dueNow, nextReview } from "./review";

const now = new Date("2026-10-30T09:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);

describe("nextReview", () => {
  it("moves a lesson one rung when most answers are right", () => {
    const r = nextReview(0, 4, 5, now);
    expect(r.step).toBe(1);
    expect(r.intervalDays).toBe(LADDER[1]);
    expect(r.dueAt).toEqual(days(LADDER[1]));
  });

  it("sends a weak review back to tomorrow", () => {
    const r = nextReview(3, 1, 5, now);
    expect(r.step).toBe(0);
    expect(r.dueAt).toEqual(days(1));
  });

  it("promotes at exactly four of five", () => {
    expect(nextReview(1, 4, 5, now).step).toBe(2);
    expect(nextReview(1, 3, 5, now).step).toBe(0);
  });

  it("stops at the top of the ladder", () => {
    expect(nextReview(4, 5, 5, now)).toEqual({ step: 4, intervalDays: 35, dueAt: days(35) });
  });

  it("treats an empty set as a miss", () => {
    expect(nextReview(2, 0, 0, now).step).toBe(0);
  });
});

describe("dueNow", () => {
  it("returns only what is due, oldest first, capped", () => {
    const rows = [
      { id: "a", dueAt: days(2) },
      { id: "b", dueAt: days(-3) },
      { id: "c", dueAt: days(-1) },
      { id: "d", dueAt: now },
    ];
    expect(dueNow(rows, now, 5).map((r) => r.id)).toEqual(["b", "c", "d"]);
    expect(dueNow(rows, now, 2).map((r) => r.id)).toEqual(["b", "c"]);
  });
});
