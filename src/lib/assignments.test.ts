import { describe, expect, it } from "vitest";
import { hasPlan, opensAssignment } from "./assignments";
import type { Grant } from "./plans";

const now = new Date("2026-11-05T12:00:00Z");
const day = 86_400_000;

function grant(over: Partial<Grant> = {}): Grant {
  return {
    accessType: "SEMESTER",
    lessonId: null,
    liveSessionId: null,
    term: 1,
    month: null,
    startsAt: new Date(now.getTime() - day),
    endsAt: new Date(now.getTime() + 30 * day),
    ...over,
  };
}

describe("hasPlan", () => {
  it("accepts a whole-course plan that is running now", () => {
    expect(hasPlan([grant()], now)).toBe(true);
  });

  it("accepts a plan with no end date", () => {
    expect(hasPlan([grant({ endsAt: null })], now)).toBe(true);
  });

  it("refuses a plan that has not started yet", () => {
    expect(hasPlan([grant({ startsAt: new Date(now.getTime() + day) })], now)).toBe(false);
  });

  it("refuses an expired plan", () => {
    expect(hasPlan([grant({ endsAt: new Date(now.getTime() - day) })], now)).toBe(false);
  });

  it("refuses a single-lecture rental and a live seat", () => {
    expect(hasPlan([grant({ lessonId: "l1" })], now)).toBe(false);
    expect(hasPlan([grant({ liveSessionId: "s1" })], now)).toBe(false);
  });

  it("accepts when any one grant qualifies", () => {
    expect(hasPlan([grant({ lessonId: "l1" }), grant()], now)).toBe(true);
  });
});

describe("opensAssignment", () => {
  const courseLevel = { courseId: "c1", lesson: null };

  it("needs a running plan for course-level homework", () => {
    expect(opensAssignment(courseLevel, [], now)).toBe(false);
    expect(opensAssignment(courseLevel, [grant({ lessonId: "l1" })], now)).toBe(false);
    expect(opensAssignment(courseLevel, [grant()], now)).toBe(true);
  });

  it("refuses a course-level plan that has not started yet", () => {
    // The same rule hasPlan already applies: a plan bought for next term must not open this term's work.
    expect(opensAssignment(courseLevel, [grant({ startsAt: new Date(now.getTime() + day) })], now)).toBe(false);
  });
});
