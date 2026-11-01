import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { askJson, extractJson } from "./ai";

const schema = z.object({ reply: z.string() });

function reply(parts: { text: string; thought?: boolean }[]) {
  return vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts } }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3 } })));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("extractJson", () => {
  it("reads bare JSON and JSON wrapped in prose", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('Sure: {"a":1} done')).toEqual({ a: 1 });
    expect(extractJson("no json")).toBeNull();
  });
});

describe("askJson", () => {
  it("is off without a key or with AI_ENABLED=0", async () => {
    const fetch = reply([{ text: '{"reply":"hi"}' }]);
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(await askJson({ system: "s", parts: [{ text: "x" }], schema })).toBeNull();
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubEnv("AI_ENABLED", "0");
    expect(await askJson({ system: "s", parts: [{ text: "x" }], schema })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("skips thinking parts and checks the schema", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubGlobal("fetch", reply([{ text: "pondering", thought: true }, { text: '{"reply":"hi"}' }]));
    const ok = await askJson({ system: "s", parts: [{ text: "x" }], schema });
    expect(ok?.data).toEqual({ reply: "hi" });
    expect(ok?.usage).toEqual({ input: 5, output: 3 });

    vi.stubGlobal("fetch", reply([{ text: '{"wrong":1}' }]));
    expect((await askJson({ system: "s", parts: [{ text: "x" }], schema }))?.data).toBeNull();
  });

  it("returns null when the request fails", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    expect(await askJson({ system: "s", parts: [{ text: "x" }], schema })).toBeNull();
  });
});
