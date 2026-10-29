import { describe, expect, it } from "vitest";
import { SUBMIT_GRACE_MS, isExpired, markExam } from "./exams";
import type { PracticeItem } from "./practice";

const item = (over: Partial<PracticeItem> & Pick<PracticeItem, "id" | "kind">): PracticeItem => ({
  marks: 2,
  answer: null,
  choices: [],
  ...over,
});

const mcq = item({ id: "m", kind: "MCQ", choices: [{ id: "c1", correct: false }, { id: "c2", correct: true }] });
const short = item({ id: "s", kind: "SHORT", answer: "سالب" });
const written = item({ id: "w", kind: "WRITTEN", marks: 10 });

describe("markExam", () => {
  it("marks objective items and leaves written ones for the teacher", () => {
    const r = markExam([mcq, short, written], [
      { itemId: "m", choiceId: "c2" },
      { itemId: "s", text: "سالب" },
      { itemId: "w", text: "إجابة طويلة" },
    ]);
    expect(r.autoMarks).toBe(4);
    expect(r.maxMarks).toBe(14);
    expect(r.needsGrading).toBe(true);
    expect(r.results.find((x) => x.itemId === "w")).toEqual({ itemId: "w", correct: null, marks: null });
  });

  it("is fully graded when the paper has no written answers", () => {
    const r = markExam([mcq], [{ itemId: "m", choiceId: "c1" }]);
    expect(r.needsGrading).toBe(false);
    expect(r.autoMarks).toBe(0);
    expect(r.results[0].correct).toBe(false);
  });

  it("gives nothing to an unanswered written item, and still needs grading", () => {
    const r = markExam([written], []);
    expect(r.needsGrading).toBe(true);
    expect(r.autoMarks).toBe(0);
  });
});

describe("isExpired", () => {
  const expires = new Date("2026-10-30T10:00:00Z");

  it("allows a submit inside the grace window", () => {
    expect(isExpired(expires, new Date(expires.getTime()))).toBe(false);
    expect(isExpired(expires, new Date(expires.getTime() + SUBMIT_GRACE_MS))).toBe(false);
  });

  it("is expired once the grace window passes", () => {
    expect(isExpired(expires, new Date(expires.getTime() + SUBMIT_GRACE_MS + 1))).toBe(true);
  });
});
