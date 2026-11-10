import { describe, expect, it } from "vitest";
import { gradeItem, normalizeAnswer, replyFrom, scoreAttempt, type PracticeItem } from "./practice";
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

describe("gradeItem MULTI", () => {
  const multi: PracticeItem = { id: "m", kind: "MULTI", marks: 3, answer: null, choices: [{ id: "a", correct: true }, { id: "b", correct: false }, { id: "c", correct: true }] };
  it("is right only when exactly the correct boxes are ticked", () => {
    expect(gradeItem(multi, { itemId: "m", choiceIds: ["c", "a"] })).toEqual({ correct: true, marks: 3 });
    expect(gradeItem(multi, { itemId: "m", choiceIds: ["a"] }).correct).toBe(false); // a missed box
    expect(gradeItem(multi, { itemId: "m", choiceIds: ["a", "b", "c"] }).correct).toBe(false); // an extra box
    expect(gradeItem(multi, { itemId: "m", choiceIds: [] }).correct).toBe(false);
  });
  it("ignores an id that is not one of the question's choices", () => {
    expect(gradeItem(multi, { itemId: "m", choiceIds: ["a", "c", "zzz"] }).correct).toBe(true);
  });
  it("is never right when no choice is marked correct", () => {
    expect(gradeItem({ ...multi, choices: [{ id: "a", correct: false }] }, { itemId: "m", choiceIds: [] }).correct).toBe(false);
  });
});

describe("replyFrom", () => {
  it("reads one radio value and several ticked boxes from the same field name", () => {
    const f = new FormData();
    f.append("choice_q", "a"); f.append("choice_q", "c"); f.append("text_q", "  ");
    expect(replyFrom(f, "q")).toEqual({ itemId: "q", choiceId: "a", choiceIds: ["a", "c"], text: "  " });
    expect(replyFrom(new FormData(), "x")).toEqual({ itemId: "x", choiceId: null, choiceIds: [], text: null });
  });
});
