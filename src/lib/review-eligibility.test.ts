import { describe, expect, it } from "vitest";
import { canRate } from "./review-eligibility";
import type { Grant } from "./plans";

const now = new Date("2026-11-20T10:00:00Z");
const entries = Array.from({ length: 10 }, (_, i) => ({ lesson: { id: `l${i}`, order: i, month: null }, term: 1, isFree: false }));
const grant = (over: Partial<Grant> = {}): Grant => ({ accessType: "YEARLY", lessonId: null, liveSessionId: null, term: null, month: null, startsAt: new Date("2026-09-01T00:00:00Z"), endsAt: new Date("2027-07-15T00:00:00Z"), ...over });
const done = (n: number) => new Set(entries.slice(0, n).map((e) => e.lesson.id));

describe("canRate", () => {
  it("needs 70% of the lessons while the plan runs", () => {
    expect(canRate(entries, [grant()], done(6), now).eligible).toBe(false);
    expect(canRate(entries, [grant()], done(7), now).eligible).toBe(true);
  });
  it("needs only 30% once the plan has ended, and still counts what it covered", () => {
    const ended = grant({ endsAt: new Date("2026-11-01T00:00:00Z") });
    expect(canRate(entries, [ended], done(2), now).eligible).toBe(false);
    expect(canRate(entries, [ended], done(3), now).eligible).toBe(true);
  });
  it("does not count a single lecture, a live seat or a plan that has not started", () => {
    expect(canRate(entries, [grant({ accessType: "RENTAL", lessonId: "l1" })], done(10), now).eligible).toBe(false);
    expect(canRate(entries, [grant({ accessType: "LIVE", liveSessionId: "s1" })], done(10), now).eligible).toBe(false);
    expect(canRate(entries, [grant({ startsAt: new Date("2026-12-01T00:00:00Z") })], done(10), now).eligible).toBe(false);
    expect(canRate(entries, [], done(10), now).eligible).toBe(false);
  });
});
