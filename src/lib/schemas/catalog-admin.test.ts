import { describe, expect, it } from "vitest";
import { countryCodeSchema, rangesOverlap, stageInput, subjectSlugSchema, timeZoneSchema } from "./catalog-admin";

describe("catalog admin inputs", () => {
  it("accepts only two-letter country codes and uppercases them", () => {
    expect(countryCodeSchema.safeParse("jo").success).toBe(true);
    expect(countryCodeSchema.parse("jo")).toBe("JO");
    expect(countryCodeSchema.safeParse("JOR").success).toBe(false);
    expect(countryCodeSchema.safeParse("1A").success).toBe(false);
  });

  it("accepts real IANA zones only", () => {
    expect(timeZoneSchema.safeParse("Asia/Dubai").success).toBe(true);
    expect(timeZoneSchema.safeParse("Africa/Cairo").success).toBe(true);
    expect(timeZoneSchema.safeParse("Mars/Olympus").success).toBe(false);
  });

  it("accepts subject slugs and rejects spaces", () => {
    expect(subjectSlugSchema.safeParse("social-studies").success).toBe(true);
    expect(subjectSlugSchema.safeParse("Social Studies").success).toBe(false);
  });

  it("rejects a stage whose range is reversed", () => {
    const base = { countryId: "c1", nameAr: "مرحلة", nameEn: "Stage", order: 0 };
    expect(stageInput.safeParse({ ...base, fromLevel: 1, toLevel: 6 }).success).toBe(true);
    expect(stageInput.safeParse({ ...base, fromLevel: 9, toLevel: 6 }).success).toBe(false);
  });

  it("detects overlapping stage ranges", () => {
    expect(rangesOverlap({ fromLevel: 1, toLevel: 6 }, { fromLevel: 6, toLevel: 9 })).toBe(true);
    expect(rangesOverlap({ fromLevel: 1, toLevel: 5 }, { fromLevel: 6, toLevel: 9 })).toBe(false);
  });
});
