// AI-assisted marking on Gemini Flash: well under a fils per submission. It runs once when the student
// hands in, and again when a teacher asks. The model never decides a grade on its own — its suggestion
// sits beside the teacher's box and the teacher confirms or overrides.
import { get } from "@vercel/blob";
import { z } from "zod";
import { askJson, type AiPart } from "./ai";
import { logAiRun } from "./ai-log";
import { db } from "./db";

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

async function readPart(pathname: string): Promise<AiPart | null> {
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
  if (!input.text?.trim() && input.files.length === 0) return null;

  const parts: AiPart[] = [];
  for (const file of input.files.slice(0, MAX_FILES)) {
    const part = await readPart(file.pathname);
    if (part) parts.push(part);
  }
  if (input.text?.trim()) parts.push({ text: `Student answer:\n${input.text.trim()}` });
  if (parts.length === 0) return null;
  parts.push({ text: `Maximum score: ${input.maxScore}. Mark it now.` });

  const result = await askJson({
    system: `${SYSTEM}\n\nAssignment: ${input.title}\n${input.instructions ?? ""}`.trim(),
    parts,
    schema: Reply,
  });
  if (!result) return null;
  const { usage, model } = result;
  if (!result.data) return { score: null, confidence: "low", rationale: "", needsReview: true, usage, model };

  const { score, confidence, rationale, needsReview } = result.data;
  return {
    score: score === null ? null : Math.max(0, Math.min(input.maxScore, Math.round(score))),
    confidence,
    rationale: rationale.trim(),
    needsReview,
    usage,
    model,
  };
}

/** Marks one stored submission and writes the suggestion beside it. False when AI gave nothing. */
export async function suggestGrade(submissionId: string): Promise<boolean> {
  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    select: {
      text: true,
      revision: true,
      studentId: true,
      files: { select: { pathname: true, contentType: true } },
      assignment: { select: { title: true, instructions: true, maxScore: true } },
    },
  });
  if (!submission) return false;
  const result = await gradeWithAi({ ...submission.assignment, text: submission.text, files: submission.files });
  if (!result) return false;
  // Usage used to be computed and thrown away, so nobody could say what grading costs.
  void logAiRun({
    kind: "grade",
    model: result.model,
    tokensIn: result.usage?.input,
    tokensOut: result.usage?.output,
    studentId: submission.studentId,
  });
  // Only the revision that was marked: a resubmission while this ran must not inherit the old mark.
  await db.submission.updateMany({
    where: { id: submissionId, revision: submission.revision },
    data: {
      aiScore: result.score,
      aiFeedback: [result.rationale, `confidence: ${result.confidence}`].filter(Boolean).join("\n").slice(0, 4000),
    },
  });
  return true;
}
