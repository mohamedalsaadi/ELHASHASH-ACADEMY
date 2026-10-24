import { describe, expect, it } from "vitest";
import { accessEnd, schoolYearEnd } from "./access";

const paidAt = new Date("2026-10-24T10:00:00Z");

describe("accessEnd", () => {
  it("counts accessDays from payment", () => {
    expect(accessEnd({ accessEndsAt: null, accessDays: 90 }, paidAt)).toEqual(new Date("2027-01-22T10:00:00Z"));
  });
  it("prefers a fixed end date", () => {
    const fixed = new Date("2027-07-15T21:59:59Z");
    expect(accessEnd({ accessEndsAt: fixed, accessDays: 90 }, paidAt)).toEqual(fixed);
  });
  it("is perpetual with neither", () => {
    expect(accessEnd({ accessEndsAt: null, accessDays: null }, paidAt)).toBeNull();
  });
});

describe("schoolYearEnd", () => {
  it("rolls over after 15 July", () => {
    expect(schoolYearEnd(new Date("2026-10-24T00:00:00Z"))).toBe("2027-07-15");
    expect(schoolYearEnd(new Date("2027-03-01T00:00:00Z"))).toBe("2027-07-15");
    expect(schoolYearEnd(new Date("2027-07-15T12:00:00Z"))).toBe("2027-07-15");
    expect(schoolYearEnd(new Date("2027-07-16T00:00:00Z"))).toBe("2028-07-15");
  });
});
