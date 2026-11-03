import { describe, expect, it } from "vitest";
import { countryRequestInput, subjectSlugFrom, teacherSubjectInput } from "./teacher-subject";

describe("teacher subject input", () => {
  it("makes a clean slug from the English name", () => {
    expect(subjectSlugFrom("Advanced  Math & Stats!")).toBe("advanced-math-stats");
    expect(subjectSlugFrom("علوم")).toBe("subject");
  });

  it("needs a country, both names and at least one grade", () => {
    const ok = { countryId: "c1", nameAr: "رياضيات", nameEn: "Math", icon: "math", gradeIds: ["g1"] };
    expect(teacherSubjectInput.safeParse(ok).success).toBe(true);
    expect(teacherSubjectInput.safeParse({ ...ok, gradeIds: [] }).success).toBe(false);
    expect(teacherSubjectInput.safeParse({ ...ok, nameEn: " " }).success).toBe(false);
  });

  it("defaults a country request's note to empty and caps it", () => {
    expect(countryRequestInput.parse({ countryId: "c1" }).note).toBe("");
    expect(countryRequestInput.safeParse({ countryId: "c1", note: "x".repeat(501) }).success).toBe(false);
  });
});
