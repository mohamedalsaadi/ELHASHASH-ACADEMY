import { describe, expect, it } from "vitest";
import { nextGrade, type GradeStep } from "./grades-next";

const g = (id: string, level: number, over: Partial<GradeStep> = {}): GradeStep => ({ id, countryId: "ae", curriculum: "MOE", level, track: "GENERAL", isTerminal: false, active: true, ...over });

describe("nextGrade", () => {
  const all = [g("g9", 9), g("g10", 10), g("g10a", 10, { track: "ADVANCED" }), g("g11a", 11, { track: "ADVANCED" }), g("g12", 12, { isTerminal: true }), g("eg10", 10, { countryId: "eg" })];

  it("moves one level up in the same country, curriculum and track", () => {
    expect(nextGrade(all[0], all)?.id).toBe("g10");
    expect(nextGrade(all[2], all)?.id).toBe("g11a");
  });
  it("keeps a student at a terminal year or with no next level", () => {
    expect(nextGrade(all[4], all)).toBeNull();
    expect(nextGrade(all[1], all)).toBeNull(); // no General grade 11 offered
  });
  it("skips a grade that is switched off", () => {
    expect(nextGrade(all[0], [g("g9", 9), g("g10", 10, { active: false })])).toBeNull();
  });
});
