import { describe, expect, it } from "vitest";
import { readiness, type ReadinessInput } from "./readiness";

const units = [
  { id: "u1", title: "Algebra", lessonIds: ["l1", "l2", "l3", "l4"] },
  { id: "u2", title: "Geometry", lessonIds: ["l5", "l6"] },
];
const now = new Date("2026-11-05T12:00:00Z");
const today = now;

function input(over: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    units,
    completed: new Set<string>(),
    confidence: new Map(),
    attempts: [],
    lastActivity: null,
    now,
    ...over,
  };
}

describe("readiness", () => {
  it("is 0 with nothing done, and says so rather than inventing a number", () => {
    const r = readiness(input());
    expect(r.score).toBe(0);
    expect(r.accuracy).toBeNull();
    expect(r.capped).toBe(true);
  });

  it("caps the score without practice: watching is not readiness", () => {
    const all = new Set(["l1", "l2", "l3", "l4", "l5", "l6"]);
    const r = readiness(input({ completed: all, lastActivity: today }));
    expect(r.coverage).toBe(1);
    expect(r.capped).toBe(true);
    expect(r.score).toBeLessThanOrEqual(55);
  });

  it("rises with accuracy once practice exists", () => {
    const weak = readiness(
      input({
        completed: new Set(["l1", "l2", "l3", "l4", "l5", "l6"]),
        attempts: [
          { lessonId: "l1", marks: 4, maxMarks: 10 },
          { lessonId: "l2", marks: 5, maxMarks: 10 },
          { lessonId: "l5", marks: 5, maxMarks: 10 },
        ],
        lastActivity: today,
      }),
    );
    const strong = readiness(
      input({
        completed: new Set(["l1", "l2", "l3", "l4", "l5", "l6"]),
        attempts: [
          { lessonId: "l1", marks: 10, maxMarks: 10 },
          { lessonId: "l2", marks: 9, maxMarks: 10 },
          { lessonId: "l5", marks: 10, maxMarks: 10 },
        ],
        lastActivity: today,
      }),
    );
    expect(weak.capped).toBe(false);
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.score).toBeLessThanOrEqual(100);
  });

  it("ignores attempts with no marks rather than dividing by zero", () => {
    const r = readiness(input({ attempts: [{ lessonId: "l1", marks: 0, maxMarks: 0 }] }));
    expect(r.accuracy).toBeNull();
  });

  it("falls to zero recency after two quiet weeks", () => {
    const r = readiness(
      input({
        completed: new Set(["l1"]),
        lastActivity: new Date(now.getTime() - 30 * 86_400_000),
      }),
    );
    expect(r.recency).toBe(0);
  });

  it("counts only answered lessons in the confidence share", () => {
    const r = readiness(
      input({
        completed: new Set(["l1", "l2", "l3"]),
        confidence: new Map([
          ["l1", "GOT_IT" as const],
          ["l2", "LOST" as const],
        ]),
      }),
    );
    expect(r.confidenceShare).toBe(0.5);
  });

  it("names the weakest unit that has enough practice", () => {
    const r = readiness(
      input({
        completed: new Set(["l1", "l2", "l3", "l4", "l5", "l6"]),
        attempts: [
          { lessonId: "l1", marks: 9, maxMarks: 10 },
          { lessonId: "l2", marks: 9, maxMarks: 10 },
          { lessonId: "l3", marks: 9, maxMarks: 10 },
          { lessonId: "l5", marks: 2, maxMarks: 10 },
          { lessonId: "l6", marks: 3, maxMarks: 10 },
          { lessonId: "l5", marks: 2, maxMarks: 10 },
        ],
        lastActivity: today,
      }),
    );
    expect(r.gap).toMatchObject({ kind: "accuracy", unitId: "u2", title: "Geometry" });
    expect((r.gap as { accuracy: number }).accuracy).toBeCloseTo(7 / 30, 5);
  });

  it("does not name a unit that is already good enough", () => {
    const r = readiness(
      input({
        completed: new Set(["l1", "l2", "l3", "l4", "l5", "l6"]),
        attempts: [
          { lessonId: "l1", marks: 9, maxMarks: 10 },
          { lessonId: "l2", marks: 9, maxMarks: 10 },
          { lessonId: "l3", marks: 9, maxMarks: 10 },
          { lessonId: "l5", marks: 9, maxMarks: 10 },
          { lessonId: "l6", marks: 9, maxMarks: 10 },
          { lessonId: "l5", marks: 9, maxMarks: 10 },
        ],
        lastActivity: today,
      }),
    );
    expect(r.gap).toBeNull();
  });

  it("falls back to the unit with the most unfinished lessons", () => {
    const r = readiness(input({ completed: new Set(["l1"]) }));
    expect(r.gap).toEqual({ kind: "unfinished", unitId: "u1", title: "Algebra", remaining: 3 });
  });

  it("needs three attempts before blaming a unit", () => {
    const r = readiness(
      input({
        completed: new Set(["l1", "l2", "l3", "l4", "l5", "l6"]),
        attempts: [
          { lessonId: "l5", marks: 1, maxMarks: 10 },
          { lessonId: "l5", marks: 1, maxMarks: 10 },
        ],
        lastActivity: today,
      }),
    );
    expect(r.gap).toBeNull();
  });
});
