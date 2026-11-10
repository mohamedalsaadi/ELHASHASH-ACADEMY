import { beforeEach, describe, expect, it, vi } from "vitest";

const askJson = vi.fn();
vi.mock("./ai", () => ({ askJson: (...a: unknown[]) => askJson(...a) }));
vi.mock("./db", () => ({ db: {} }));
vi.mock("./ai-log", () => ({ logAiRun: vi.fn() }));
vi.mock("@vercel/blob", () => ({ get: vi.fn() }));

import { gradeWithAi } from "./ai-grading";

const base = { title: "t", instructions: null, maxScore: 10, files: [] };
const usage = { input: 1, output: 1 };

describe("gradeWithAi", () => {
  beforeEach(() => askJson.mockReset());

  it("does not call the model for an empty answer", async () => {
    expect(await gradeWithAi({ ...base, text: "  " })).toBeNull();
    expect(askJson).not.toHaveBeenCalled();
  });

  it("returns null when the model gives nothing", async () => {
    askJson.mockResolvedValue(null);
    expect(await gradeWithAi({ ...base, text: "x" })).toBeNull();
  });

  it("asks for review when the reply is unparseable", async () => {
    askJson.mockResolvedValue({ data: null, usage, model: "m" });
    const r = await gradeWithAi({ ...base, text: "x" });
    expect(r).toMatchObject({ score: null, needsReview: true });
  });

  it("clamps the score to the maximum", async () => {
    askJson.mockResolvedValue({ data: { score: 99, confidence: "high", rationale: " ok ", needsReview: false }, usage, model: "m" });
    const r = await gradeWithAi({ ...base, text: "x" });
    expect(r?.score).toBe(10);
    expect(r?.rationale).toBe("ok");
  });
});

describe("suggestAnswer", () => {
  const update = vi.fn();
  const findUnique = vi.fn();
  beforeEach(() => { askJson.mockReset(); update.mockReset(); findUnique.mockReset(); });

  async function load() {
    vi.resetModules();
    vi.doMock("./ai", () => ({ askJson: (...a: unknown[]) => askJson(...a) }));
    vi.doMock("./db", () => ({ db: { examAnswer: { findUnique, update } } }));
    vi.doMock("./ai-log", () => ({ logAiRun: vi.fn() }));
    vi.doMock("@vercel/blob", () => ({ get: vi.fn() }));
    return (await import("./ai-grading")).suggestAnswer;
  }
  const row = (kind = "WRITTEN") => ({ text: "because x", attempt: { userId: "u" }, item: { kind, prompt: "Why?", answer: "since x", marks: 4, media: [] } });

  it("stores a clamped suggestion and never writes the student's mark", async () => {
    findUnique.mockResolvedValue(row());
    askJson.mockResolvedValue({ data: { score: 9, confidence: "high", rationale: "good", needsReview: false }, usage: { input: 1, output: 1 }, model: "m" });
    expect(await (await load())("a1")).toBe(true);
    const data = update.mock.calls[0][0].data;
    expect(data.aiMarks).toBe(4);
    expect(data).not.toHaveProperty("marks");
    expect(data).not.toHaveProperty("correct");
  });

  it("does nothing for an answer that is not a written one", async () => {
    findUnique.mockResolvedValue(row("MCQ"));
    expect(await (await load())("a1")).toBe(false);
    expect(askJson).not.toHaveBeenCalled();
  });

  it("writes nothing when the model gives nothing (AI off or failed)", async () => {
    findUnique.mockResolvedValue(row());
    askJson.mockResolvedValue(null);
    expect(await (await load())("a1")).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
