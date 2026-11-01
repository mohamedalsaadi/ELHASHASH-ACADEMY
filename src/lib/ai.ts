// The one Gemini call every AI feature goes through. Plain fetch, no SDK: one POST and a zod check.
// AI_ENABLED=0 turns every feature off at once; the app then works by hand as before.
import type { z } from "zod";

/**
 * One constant to change if handwriting ever needs a stronger reader. 2.5 Flash is closed to new
 * Google API keys, so this tracks the current Flash generation.
 */
export const AI_MODEL = process.env.AI_MODEL || "gemini-3.6-flash";

export type AiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export type AiResult<T> = { data: T | null; usage: { input: number; output: number }; model: string };

export const aiEnabled = () => !!process.env.GEMINI_API_KEY && process.env.AI_ENABLED !== "0";

/** Pulls the JSON object out of a reply, tolerating prose around it. */
export function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/**
 * Asks for JSON and checks it against `schema`. Null when AI is off or the request failed;
 * `data: null` when the model answered with something unusable.
 */
export async function askJson<T>(input: {
  system: string;
  parts: AiPart[];
  schema: z.ZodType<T>;
  maxTokens?: number;
}): Promise<AiResult<T> | null> {
  if (!aiEnabled()) return null;
  const key = process.env.GEMINI_API_KEY!;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents: [{ role: "user", parts: input.parts }],
        // 3.x models reason before answering, and those tokens count against the budget.
        generationConfig: { temperature: 0, maxOutputTokens: input.maxTokens ?? 2048, responseMimeType: "application/json" },
      }),
    },
  ).catch(() => null);
  if (!response?.ok) return null;

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const usage = { input: data.usageMetadata?.promptTokenCount ?? 0, output: data.usageMetadata?.candidatesTokenCount ?? 0 };
  // Thinking parts carry the model's reasoning; only the answer part is JSON.
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => p.thought !== true)
    .map((p) => p.text ?? "")
    .join("");
  const parsed = input.schema.safeParse(text ? extractJson(text) : null);
  return { data: parsed.success ? parsed.data : null, usage, model: AI_MODEL };
}
