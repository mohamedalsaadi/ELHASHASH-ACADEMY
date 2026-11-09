import { beforeEach, describe, expect, it, vi } from "vitest";

const askJson = vi.fn();
vi.mock("./ai", () => ({ askJson: (...a: unknown[]) => askJson(...a) }));
vi.mock("./ai-grading", () => ({ readPart: vi.fn(async () => ({ inlineData: { mimeType: "image/jpeg", data: "x" } })) }));

import { askLesson, hasLessonSource } from "./ai-lesson";

const usage = { input: 1, output: 1 };
const lesson = { title: "t", notes: "Newton's second law: F = ma", pdfPages: [] as string[] };

describe("ask about this lesson", () => {
  beforeEach(() => askJson.mockReset());

  it("needs notes or pages", () => {
    expect(hasLessonSource({ notes: " ", pdfPages: [] })).toBe(false);
    expect(hasLessonSource({ notes: null, pdfPages: ["a"] })).toBe(true);
  });

  it("does not call the model without a source or a question", async () => {
    expect(await askLesson({ ...lesson, notes: null, question: "why?" })).toBeNull();
    expect(await askLesson({ ...lesson, question: "  " })).toBeNull();
    expect(askJson).not.toHaveBeenCalled();
  });

  it("sends the notes and the question and returns the answer", async () => {
    askJson.mockResolvedValue({ data: { answer: " F equals m times a ", covered: true }, usage, model: "m" });
    const r = await askLesson({ ...lesson, question: "what is F?" });
    expect(r).toMatchObject({ answer: "F equals m times a", covered: true });
    expect(JSON.stringify(askJson.mock.calls[0][0].parts)).toContain("F = ma");
  });

  it("returns null when the model fails or answers unusably", async () => {
    askJson.mockResolvedValue(null);
    expect(await askLesson({ ...lesson, question: "q" })).toBeNull();
    askJson.mockResolvedValue({ data: null, usage, model: "m" });
    expect(await askLesson({ ...lesson, question: "q" })).toBeNull();
  });
});
