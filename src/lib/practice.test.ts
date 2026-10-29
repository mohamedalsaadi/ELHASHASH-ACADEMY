import { describe, expect, it } from "vitest";
import { gradeItem, masteryOf, normalizeAnswer, scoreAttempt, type PracticeItem } from "./practice";
import { nextStreak, practiceXp } from "./progress";

const mcq = (marks = 1): PracticeItem => ({
  id: "q1",
  kind: "MCQ",
  marks,
  answer: null,
  choices: [
    { id: "a", correct: false },
    { id: "b", correct: true },
  ],
});

const short = (answer: string, marks = 2): PracticeItem => ({ id: "q2", kind: "SHORT", marks, answer, choices: [] });

describe("normalizeAnswer", () => {
  it("folds Arabic diacritics, alef and ya variants, and ta marbuta", () => {
    expect(normalizeAnswer("القُوَّة")).toBe(normalizeAnswer("القوه"));
    expect(normalizeAnswer("أحمد")).toBe("احمد");
    expect(normalizeAnswer("مصطفى")).toBe("مصطفي");
  });

  it("converts Arabic-Indic digits and ignores punctuation and spacing", () => {
    expect(normalizeAnswer("١٢")).toBe("12");
    expect(normalizeAnswer("  ثلاثة،  ")).toBe(normalizeAnswer("ثلاثه"));
  });

  it("keeps different answers different", () => {
    expect(normalizeAnswer("سالب")).not.toBe(normalizeAnswer("موجب"));
  });
});

describe("gradeItem", () => {
  it("marks the correct choice and ignores the rest", () => {
    expect(gradeItem(mcq(3), { itemId: "q1", choiceId: "b" })).toEqual({ correct: true, marks: 3 });
    expect(gradeItem(mcq(3), { itemId: "q1", choiceId: "a" })).toEqual({ correct: false, marks: 0 });
    expect(gradeItem(mcq(3), { itemId: "q1", choiceId: null })).toEqual({ correct: false, marks: 0 });
  });

  it("accepts a short answer written without diacritics", () => {
    expect(gradeItem(short("القُوَّة"), { itemId: "q2", text: "القوه" })).toEqual({ correct: true, marks: 2 });
  });

  it("refuses a blank short answer even when the canonical answer is empty", () => {
    expect(gradeItem({ ...short(""), id: "q3" }, { itemId: "q3", text: "" })).toEqual({ correct: false, marks: 0 });
  });
});

describe("scoreAttempt", () => {
  it("sums marks and counts correct answers, missing replies scoring zero", () => {
    const r = scoreAttempt([mcq(2), short("سالب", 3)], [{ itemId: "q1", choiceId: "b" }]);
    expect(r.marks).toBe(2);
    expect(r.maxMarks).toBe(5);
    expect(r.correct).toBe(1);
    expect(r.results[1].correct).toBe(false);
  });
});

describe("masteryOf", () => {
  it("starts unseen, needs a full recent run to be secure", () => {
    expect(masteryOf([])).toBe("unseen");
    expect(masteryOf([true])).toBe("developing");
    expect(masteryOf([true, true])).toBe("secure");
    expect(masteryOf([true, true, false])).toBe("developing");
    expect(masteryOf([true, false, true, true])).toBe("developing");
    expect(masteryOf([false, true, true, true])).toBe("secure");
  });
});

describe("XP and streaks", () => {
  it("pays per correct answer plus a completion bonus", () => {
    expect(practiceXp(3, 5)).toBe(11);
    expect(practiceXp(0, 5)).toBe(5);
    expect(practiceXp(0, 0)).toBe(0);
  });

  it("counts one day at a time", () => {
    const today = new Date("2026-10-29T20:00:00Z");
    expect(nextStreak(null, 0, today)).toEqual({ streak: 1, counted: true });
    expect(nextStreak(new Date("2026-10-29T08:00:00Z"), 4, today)).toEqual({ streak: 4, counted: false });
    expect(nextStreak(new Date("2026-10-28T23:00:00Z"), 4, today)).toEqual({ streak: 5, counted: true });
    expect(nextStreak(new Date("2026-10-20T10:00:00Z"), 4, today)).toEqual({ streak: 1, counted: true });
  });
});
