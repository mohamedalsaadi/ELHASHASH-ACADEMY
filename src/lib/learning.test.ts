import { describe, expect, it } from "vitest";
import { courseProgress, groupLive, lessonEntries, livePhase, neighbours, nextOpenLesson, type UnitNode } from "./learning";
import type { Grant } from "./plans";

const now = new Date("2026-10-26T12:00:00Z");
const DAY = 86_400_000;

function grant(over: Partial<Grant> = {}): Grant {
  return {
    accessType: null,
    lessonId: null,
    liveSessionId: null,
    term: null,
    month: null,
    startsAt: new Date(now.getTime() - DAY),
    endsAt: null,
    ...over,
  };
}

const units: UnitNode<{ id: string; order: number; month: number | null }>[] = [
  {
    order: 2,
    term: 2,
    isFree: false,
    lessons: [
      { id: "b2", order: 2, month: 4 },
      { id: "b1", order: 1, month: 4 },
    ],
  },
  {
    order: 1,
    term: 1,
    isFree: true,
    lessons: [{ id: "a1", order: 1, month: 1 }],
  },
];

describe("lesson order", () => {
  it("walks units then lessons in order", () => {
    expect(lessonEntries(units).map((e) => e.lesson.id)).toEqual(["a1", "b1", "b2"]);
  });

  it("finds the neighbours and stops at the ends", () => {
    const ordered = ["a1", "b1", "b2"].map((id) => ({ id }));
    expect(neighbours(ordered, "b1")).toEqual({ prev: { id: "a1" }, next: { id: "b2" } });
    expect(neighbours(ordered, "a1").prev).toBeUndefined();
    expect(neighbours(ordered, "b2").next).toBeUndefined();
  });
});

describe("courseProgress", () => {
  const entries = lessonEntries(units);

  it("counts only openable lessons in the denominator", () => {
    // A month-1 plan opens the free unit only; the two month-4 lessons stay outside it.
    const p = courseProgress(entries, [grant({ accessType: "MONTHLY", month: 1 })], new Set(["b1"]), now);
    expect(p.total).toBe(1);
    expect(p.all).toBe(3);
    expect(p.done).toBe(0); // b1 is completed but not openable, so it must not inflate the plan's progress
    expect(p.doneAll).toBe(1);
  });

  it("gives a whole-course plan the full denominator", () => {
    const p = courseProgress(entries, [grant()], new Set(["a1", "b1"]), now);
    expect(p.total).toBe(3);
    expect(p.done).toBe(2);
    expect(p.pct).toBe(67);
  });

  it("ignores an expired grant", () => {
    const p = courseProgress(entries, [grant({ endsAt: new Date(now.getTime() - DAY) })], new Set(), now);
    expect(p.total).toBe(1); // the free unit only
  });
});

describe("nextOpenLesson", () => {
  const entries = lessonEntries(units);

  it("skips completed and locked lessons", () => {
    const next = nextOpenLesson(entries, [grant({ accessType: "SEMESTER", term: 2 })], new Set(["a1"]), now);
    expect(next?.lesson.id).toBe("b1");
  });

  it("can start after the lesson just finished", () => {
    const next = nextOpenLesson(entries, [grant()], new Set(["a1"]), now, "a1");
    expect(next?.lesson.id).toBe("b1");
  });

  it("returns nothing when everything open is done", () => {
    expect(nextOpenLesson(entries, [grant()], new Set(["a1", "b1", "b2"]), now)).toBeUndefined();
  });
});

describe("livePhase", () => {
  const startsAt = new Date(now.getTime() + 60 * 60 * 1000); // one hour out

  it("is soon within two hours", () => {
    expect(livePhase(startsAt, 60, now)).toBe("soon");
  });

  it("is later beyond two hours", () => {
    expect(livePhase(new Date(now.getTime() + 3 * 60 * 60 * 1000), 60, now)).toBe("later");
  });

  it("is now between start and end", () => {
    expect(livePhase(new Date(now.getTime() - 60_000), 60, now)).toBe("now");
  });

  it("is ended after the duration", () => {
    expect(livePhase(new Date(now.getTime() - 2 * 60 * 60 * 1000), 60, now)).toBe("ended");
  });

  it("groups without the ended ones", () => {
    const sessions = [
      { id: "ended", startsAt: new Date(now.getTime() - 3 * 60 * 60 * 1000), durationMin: 60 },
      { id: "now", startsAt: new Date(now.getTime() - 60_000), durationMin: 60 },
      { id: "soon", startsAt, durationMin: 60 },
      { id: "later", startsAt: new Date(now.getTime() + 5 * 60 * 60 * 1000), durationMin: 60 },
    ];
    const g = groupLive(sessions, now);
    expect([g.now, g.soon, g.later].map((list) => list.map((s) => s.id))).toEqual([["now"], ["soon"], ["later"]]);
  });
});

describe("nextOpenLesson for staff", () => {
  const entries = [
    { lesson: { id: "a", order: 1, month: null }, term: 1, isFree: false },
    { lesson: { id: "b", order: 2, month: null }, term: 2, isFree: false },
  ];
  it("finds nothing for a plan that does not open the next lesson, and the lesson for staff", () => {
    expect(nextOpenLesson(entries, [], new Set(), new Date(), "a")).toBeUndefined();
    expect(nextOpenLesson(entries, [], new Set(), new Date(), "a", true)?.lesson.id).toBe("b");
  });
});
