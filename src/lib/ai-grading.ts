// AI-assisted marking. Cheap by design: Sonnet rather than Opus (half the price), one call per submission,
// only when a teacher asks for it, capped per teacher per day. The model never decides a grade on its own —
// its suggestion is stored beside the teacher's box, and the teacher confirms or overrides.
import Anthropic from "@anthropic-ai/sdk";
import { get } from "@vercel/blob";
import { z } from "zod";

/** One constant to change if handwriting needs a stronger reader. */
export const AI_MODEL = "claude-sonnet-5-5";

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
  usage: { input: number; output: number; cached: number };
  model: string;
};

const SYSTEM = [
  "You mark secondary-school homework for an Arabic-first academy.",
  "Mark only what the student actually wrote or drew. Never assume a missing step was done.",
  "Score out of the maximum you are given, in whole marks.",
  "If the work is blank, unreadable, off-topic, or you are not confident, return score null with needsReview true — a wrong automatic mark is worse than a slow one.",
  'Reply with JSON and nothing else: {"score": number|null, "confidence": "high"|"medium"|"low", "rationale": string, "needsReview": boolean}',
].join(" ");

async function readPart(pathname: string): Promise<{ mediaType: string; data: string } | null> {
  const blob = await get(pathname, { access: "private" });
  if (!blob || blob.statusCode !== 200) return null;
  const buffer = Buffer.from(await new Response(blob.stream).arrayBuffer());
  if (buffer.length > MAX_BYTES) return null;
  return { mediaType: blob.blob.contentType, data: buffer.toString("base64") };
}

/** First JSON object in the reply, tolerating a stray code fence. */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function gradeWithClaude(input: {
  title: string;
  instructions: string | null;
  maxScore: number;
  text: string | null;
  files: { pathname: string; contentType: string }[];
}): Promise<AiGrade | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!input.text?.trim() && input.files.length === 0) return null;

  const client = new Anthropic({ apiKey });
  const content: Anthropic.ContentBlockParam[] = [];

  for (const file of input.files.slice(0, MAX_FILES)) {
    const part = await readPart(file.pathname);
    if (!part) continue;
    if (part.mediaType.startsWith("image/")) {
      content.push({ type: "image", source: { type: "base64", media_type: part.mediaType as "image/png" | "image/jpeg" | "image/webp", data: part.data } });
    } else if (part.mediaType === "application/pdf") {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: part.data } });
    }
  }
  if (input.text?.trim()) content.push({ type: "text", text: `Student answer:\n${input.text.trim()}` });
  if (content.length === 0) return null;

  content.push({ type: "text", text: `Maximum score: ${input.maxScore}. Mark it now.` });

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 1024,
    system: `${SYSTEM}\n\nAssignment: ${input.title}\n${input.instructions ?? ""}`.trim(),
    messages: [{ role: "user", content }],
  });

  const usage = {
    input: response.usage.input_tokens,
    output: response.usage.output_tokens,
    cached: response.usage.cache_read_input_tokens ?? 0,
  };

  if (response.stop_reason === "refusal") {
    return { score: null, confidence: "low", rationale: "", needsReview: true, usage, model: AI_MODEL };
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = Reply.safeParse(extractJson(text));
  if (!parsed.success) {
    return { score: null, confidence: "low", rationale: "", needsReview: true, usage, model: AI_MODEL };
  }

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
