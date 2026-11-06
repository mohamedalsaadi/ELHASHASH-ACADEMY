import { describe, expect, it } from "vitest";
import { ageOn, isMinor, parseBirthDate } from "./age";

const now = new Date("2026-11-06T12:00:00Z");

describe("ageOn", () => {
  it("counts a birthday today as the new age", () => {
    expect(ageOn(new Date("2008-11-06T00:00:00Z"), now)).toBe(18);
    expect(ageOn(new Date("2008-11-07T00:00:00Z"), now)).toBe(17);
  });
});

describe("isMinor", () => {
  it("treats 17 as minor and 18 as adult", () => {
    expect(isMinor(new Date("2009-01-01T00:00:00Z"), now)).toBe(true);
    expect(isMinor(new Date("2008-01-01T00:00:00Z"), now)).toBe(false);
  });

  it("treats an unknown birth date as an adult legacy account", () => {
    expect(isMinor(null, now)).toBe(false);
    expect(isMinor(undefined, now)).toBe(false);
  });
});

describe("parseBirthDate", () => {
  it("accepts a real date and rejects an impossible one", () => {
    expect(parseBirthDate("2009-03-14", now)?.toISOString().slice(0, 10)).toBe("2009-03-14");
    expect(parseBirthDate("2026-02-31", now)).toBeNull();
    expect(parseBirthDate("not-a-date", now)).toBeNull();
  });

  it("rejects a future birthday", () => {
    expect(parseBirthDate("2027-01-01", now)).toBeNull();
  });
});
