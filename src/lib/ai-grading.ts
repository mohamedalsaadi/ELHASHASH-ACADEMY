// AI-assisted marking on Gemini 2.5 Flash: roughly half a fils per submission (an image is about $0.0009,
// plus a few hundred prompt and output tokens), one call per submission, only when a teacher asks, capped
// per teacher per day. The model never decides a grade on its own — its suggestion sits beside the
// teacher's box and the teacher confirms or overrides.
import { get } from "@vercel/blob";
import { z } from "zod";

/** One constant to change if handwriting ever needs a stronger reader. */
export const AI_MODEL = "gemini-2.5-flash";

const MAX_FILES = 3;
const MAX_BYTES = 8 * 1024 * 1024;

const Reply = z.object({
  score: z.number().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  rationale: z.string().max(2000),
  needsReview: z.boolean(),
});

export type AiGrade = {
  score: number | null;
  confidence: "high" | "medium" | "low";
  rationale: string;
  needsReview: boolean;
  usage: { input: number; output: number };
  model: string;
};

const SYSTEM = [
  "You mark secondary-school homework for an Arabic-first academy.",
  "Mark only what the student actually wrote or drew. Never assume a missing step was done.",
  "Score in whole marks out of the maximum you are given.",
  "If the work is blank, unreadable, off-topic, or you are not confident, return score null with needsReview true — a wrong automatic mark is worse than a slow one.",
  'Reply with JSON only: {"score": number|null, "confidence": "high"|"medium"|"low", "rationale": string, "needsReview": boolean}',
].join(" ");

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

async function readPart(pathname: string): Promise<Part | null> {
  const blob = await get(pathname, { access: "private" });
  if (!blob || blob.statusCode !== 200) return null;
  const buffer = Buffer.from(await new Response(blob.stream).arrayBuffer());
  if (buffer.length > MAX_BYTES) return null;
  const mimeType = blob.blob.contentType;
  if (!mimeType.startsWith("image/") && mimeType !== "application/pdf") return null;
  return { inlineData: { mimeType, data: buffer.toString("base64") } };
}

export async function gradeWithAi(input: {
  title: string;
  instructions: string | null;
  maxScore: number;
  text: string | null;
  files: { pathname: string; contentType: string }[];
}): Promise<AiGrade | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!input.text?.trim() && input.files.length === 0) return null;

  const parts: Part[] = [];
  for (const file of input.files.slice(0, MAX_FILES)) {
    const part = await readPart(file.pathname);
    if (part) parts.push(part);
  }
  if (input.text?.trim()) parts.push({ text: `Student answer:\n${input.text.trim()}` });
  if (parts.length === 0) return null;
  parts.push({ text: `Maximum score: ${input.maxScore}. Mark it now.` });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${SYSTEM}\n\nAssignment: ${input.title}\n${input.instructions ?? ""}`.trim() }] },
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0, maxOutputTokens: 1024, responseMimeType: "application/json" },
      }),
    },
  );
  if (!response.ok) return null;

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };

  const usage = { input: data.usageMetadata?.promptTokenCount ?? 0, output: data.usageMetadata?.candidatesTokenCount ?? 0 };
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  if (!text) return { score: null, confidence: "low", rationale: "", needsReview: true, usage, model: AI_MODEL };

  let parsedJson: unknown = null;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        parsedJson = JSON.parse(text.slice(start, end + 1));
      } catch {
        parsedJson = null;
      }
    }
  }

  const parsed = Reply.safeParse(parsedJson);
  if (!parsed.success) return { score: null, confidence: "low", rationale: "", needsReview: true, usage, model: AI_MODEL };

  const { score, confidence, rationale, needsReview } = parsed.data;
  return {
    score: score === null ? null : Math.max(0, Math.min(input.maxScore, Math.round(score))),
    confidence,
    rationale: rationale.trim(),
    needsReview,
    usage,
    model: AI_MODEL,
  };
}
