import { describe, expect, it } from "vitest";
import { STAGES, gradeName, stageOf } from "./stages";

describe("stages", () => {
  it("covers grades 1–12 once in every country", () => {
    for (const stages of Object.values(STAGES)) {
      const levels = stages.flatMap((s) => Array.from({ length: s.to - s.from + 1 }, (_, i) => s.from + i));
      expect(levels).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    }
  });

  it("names grades the way each country does", () => {
    expect(gradeName("EG", 12)).toEqual({ nameAr: "الصف الثالث الثانوي", nameEn: "Secondary 3" });
    expect(gradeName("EG", 7)).toEqual({ nameAr: "الصف الأول الإعدادي", nameEn: "Preparatory 1" });
    expect(gradeName("SA", 8)).toEqual({ nameAr: "الصف الثاني المتوسط", nameEn: "Intermediate 2" });
    expect(gradeName("KW", 11)).toEqual({ nameAr: "الصف الحادي عشر", nameEn: "Grade 11" });
    expect(stageOf("KW", 6).en).toBe("Intermediate");
    expect(stageOf("OM", 10).en).toBe("Cycle 2");
  });
});
