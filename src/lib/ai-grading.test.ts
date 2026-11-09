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
