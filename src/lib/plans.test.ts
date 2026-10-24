import { describe, expect, it } from "vitest";
import { lecturesIn, mayAsk, opensLesson, opensLive, planValue, type Grant } from "./plans";

const now = new Date("2026-11-10T10:00:00Z");
const before = new Date("2026-10-01T00:00:00Z");
const later = new Date("2026-12-01T00:00:00Z");
const grant = (g: Partial<Grant>): Grant => ({ accessType: null, lessonId: null, liveSessionId: null, term: null, month: null, startsAt: before, endsAt: later, ...g });
const lesson = (id: string, month: number | null, term: number) => ({ id, month, term });

describe("opensLesson", () => {
  it("a rental opens only its own lesson", () => {
    const g = grant({ accessType: "RENTAL", lessonId: "a" });
    expect(opensLesson(g, lesson("a", 1, 1), now)).toBe(true);
    expect(opensLesson(g, lesson("b", 1, 1), now)).toBe(false);
  });
  it("a monthly plan opens its month's lectures only", () => {
    const g = grant({ accessType: "MONTHLY", month: 3 });
    expect(opensLesson(g, lesson("a", 3, 1), now)).toBe(true);
    expect(opensLesson(g, lesson("b", 4, 1), now)).toBe(false);
    expect(opensLesson(g, lesson("c", null, 1), now)).toBe(false);
  });
  it("a semester plan opens its term's lectures only", () => {
    const g = grant({ accessType: "SEMESTER", term: 2 });
    expect(opensLesson(g, lesson("a", 6, 2), now)).toBe(true);
    expect(opensLesson(g, lesson("b", 1, 1), now)).toBe(false);
  });
  it("a semester plan with no term, a yearly plan and an old grant open everything", () => {
    for (const g of [grant({ accessType: "SEMESTER" }), grant({ accessType: "YEARLY" }), grant({})]) {
      expect(opensLesson(g, lesson("a", 9, 2), now)).toBe(true);
    }
  });
  it("nothing opens once expired or before it starts", () => {
    expect(opensLesson(grant({ accessType: "YEARLY", endsAt: before }), lesson("a", 1, 1), now)).toBe(false);
    expect(opensLesson(grant({ accessType: "YEARLY", startsAt: later }), lesson("a", 1, 1), now)).toBe(false);
  });
  it("a live seat opens no lecture", () => {
    expect(opensLesson(grant({ accessType: "LIVE", liveSessionId: "s" }), lesson("a", 1, 1), now)).toBe(false);
  });
});

describe("opensLive", () => {
  it("semester and yearly plans include live sessions while active", () => {
    expect(opensLive(grant({ accessType: "SEMESTER", term: 1 }), "s", now)).toBe(true);
    expect(opensLive(grant({ accessType: "YEARLY" }), "s", now)).toBe(true);
    expect(opensLive(grant({ accessType: "SEMESTER", term: 1, endsAt: before }), "s", now)).toBe(false);
  });
  it("a monthly plan and a rental give no live sessions", () => {
    expect(opensLive(grant({ accessType: "MONTHLY", month: 3 }), "s", now)).toBe(false);
    expect(opensLive(grant({ accessType: "RENTAL", lessonId: "a" }), "s", now)).toBe(false);
  });
  it("a seat opens its own session only", () => {
    expect(opensLive(grant({ accessType: "LIVE", liveSessionId: "s" }), "s", now)).toBe(true);
    expect(opensLive(grant({ accessType: "LIVE", liveSessionId: "s" }), "t", now)).toBe(false);
  });
});

describe("mayAsk", () => {
  it("monthly and semester subscribers ask about lectures their plan opens", () => {
    expect(mayAsk(grant({ accessType: "MONTHLY", month: 3 }), lesson("a", 3, 1), now)).toBe(true);
    expect(mayAsk(grant({ accessType: "MONTHLY", month: 3 }), lesson("b", 4, 1), now)).toBe(false);
    expect(mayAsk(grant({ accessType: "SEMESTER", term: 1 }), lesson("a", 3, 1), now)).toBe(true);
  });
  it("a single rented lecture can't ask", () => {
    expect(mayAsk(grant({ accessType: "RENTAL", lessonId: "a" }), lesson("a", 3, 1), now)).toBe(false);
  });
});

describe("planValue", () => {
  it("works out the price per lecture and the saving against singles", () => {
    // 8 lectures for 200 AED against 40 AED each: 25 a lecture, 38% off 320.
    expect(planValue(20000, 8, 4000)).toEqual({ perLecture: 2500, savePct: 38 });
  });
  it("a plan dearer than singles shows a negative saving", () => {
    expect(planValue(40000, 8, 4000)).toEqual({ perLecture: 5000, savePct: -25 });
  });
  it("no single price means no saving; no lectures means nothing to show", () => {
    expect(planValue(20000, 8, null)).toEqual({ perLecture: 2500, savePct: null });
    expect(planValue(20000, 0, 4000)).toBeNull();
  });
  it("keeps three-decimal currencies whole", () => {
    expect(planValue(10000, 3, null)?.perLecture).toBe(3333);
  });
});

describe("lecturesIn", () => {
  const units = [
    { isFree: true, term: 1, lessons: [{ month: 1 }] },
    { isFree: false, term: 1, lessons: [{ month: 1 }, { month: 2 }, { month: 2 }] },
    { isFree: false, term: 2, lessons: [{ month: 6 }, { month: null }] },
  ];
  it("counts the paid lectures a plan opens", () => {
    expect(lecturesIn(units, { accessType: "MONTHLY", month: 2, term: null })).toBe(2);
    expect(lecturesIn(units, { accessType: "SEMESTER", month: null, term: 2 })).toBe(2);
    expect(lecturesIn(units, { accessType: "SEMESTER", month: null, term: null })).toBe(5);
    expect(lecturesIn(units, { accessType: "YEARLY", month: null, term: null })).toBe(5);
  });
});
