import { describe, expect, it } from "vitest";
import { fillDays, weakSpots, type Insights } from "./insights";

const base: Insights = {
  days: 30, signups: [], signupsByCountry: [], activation: { total: 0, learned: 0, enrolled: 0 }, orders: [], revenue: [],
  funnel: [], signupFunnel: [{ name: "signup_viewed", n: 0 }, { name: "signup_completed", n: 0 }], plays: [], playsByHour: [], playsByCountry: [], weekly: [],
  mobile: { mobile: 0, total: 0 }, courses: [], slowLessons: [], hardPractice: [],
  support: { daily: [], open: 0, avgReplyHours: null, total: 0 }, errors: { daily: [], bySource: [], total: 0 }, heldReviews: 0,
};

describe("fillDays", () => {
  it("gives one point per Dubai day with zeros for quiet days", () => {
    const now = new Date("2026-11-15T22:30:00Z"); // 02:30 on the 16th in Dubai
    const out = fillDays([{ d: "2026-11-16", n: 3 }, { d: "2026-11-14", n: 1 }], 3, now);
    expect(out).toEqual([{ d: "2026-11-14", n: 1 }, { d: "2026-11-15", n: 0 }, { d: "2026-11-16", n: 3 }]);
  });
});

describe("weakSpots", () => {
  it("is quiet when there is little data", () => {
    expect(weakSpots(base, false)).toEqual([]);
  });
  it("flags a sign-up drop, an unsold course, a low rating and a slow lesson", () => {
    const d: Insights = {
      ...base,
      signupFunnel: [{ name: "signup_viewed", n: 100 }, { name: "signup_completed", n: 20 }],
      courses: [
        { id: "a", titleAr: "أ", titleEn: "A", views: 40, buyers: 0, lessonViews: 0, completed: 0, rating: 3.2, ratings: 5 },
      ],
      slowLessons: [{ id: "l", titleAr: "د", titleEn: "L", courseAr: "أ", courseEn: "A", views: 10, completed: 2 }],
      errors: { daily: [], bySource: [], total: 12 },
    };
    const keys = weakSpots(d, false).map((w) => w.key);
    expect(keys).toEqual(expect.arrayContaining(["signupDrop", "viewNoBuy", "lowRating", "slowLesson", "errors"]));
    expect(weakSpots(d, false).find((w) => w.key === "signupDrop")?.vars.pct).toBe(80);
  });
  it("uses the Arabic title when asked", () => {
    const d: Insights = { ...base, courses: [{ id: "a", titleAr: "رياضيات", titleEn: "Maths", views: 30, buyers: 0, lessonViews: 0, completed: 0, rating: null, ratings: 0 }] };
    expect(weakSpots(d, true)[0].vars.name).toBe("رياضيات");
  });
});
