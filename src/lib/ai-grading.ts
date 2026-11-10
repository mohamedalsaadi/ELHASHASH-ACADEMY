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

export async function readPart(pathname: string): Promise<AiPart | null> {
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
  rubric?: string | null;
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
    system: `${SYSTEM}\n\nAssignment: ${input.title}\n${input.instructions ?? ""}${input.rubric ? `
Marking guide from the teacher (mark against it): ${input.rubric}` : ""}`.trim(),
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
      assignment: { select: { title: true, instructions: true, rubric: true, maxScore: true } },
    },
  });
  if (!submission) return false;
  const input = { ...submission.assignment, text: submission.text, files: submission.files };
  // One retry: a model call fails now and then, and a teacher waiting on a button should not have to press twice.
  const result = (await gradeWithAi(input)) ?? (await gradeWithAi(input));
  if (!result) {
    void logAiRun({ kind: "grade", model: "none", studentId: submission.studentId, status: "ERROR" });
    return false;
  }
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
      aiFeedback: [result.rationale, `confidence: ${result.confidence}`, result.needsReview ? "needs review" : ""].filter(Boolean).join("\n").slice(0, 4000),
    },
  });
  return true;
}

type WrittenItem = { kind: string; prompt: string; answer: string | null; marks: number; media: string[] };

/** One written answer against its question (typed, or a picture) and the teacher's model answer. Null when AI gave nothing. */
async function markWritten(item: WrittenItem, text: string | null, studentId: string) {
  const input = {
    title: "Question",
    instructions: item.prompt || "The question is in the attached picture.",
    rubric: item.answer ? `Model answer: ${item.answer}` : null,
    maxScore: item.marks,
    text,
    // The question's own pages (a picture or a PDF turned into JPEG pages), so the model sees what was asked.
    files: item.media.map((pathname) => ({ pathname, contentType: "image/jpeg" })),
  };
  const result = (await gradeWithAi(input)) ?? (await gradeWithAi(input));
  if (!result) {
    void logAiRun({ kind: "grade", model: "none", studentId, status: "ERROR" });
    return null;
  }
  void logAiRun({ kind: "grade", model: result.model, tokensIn: result.usage?.input, tokensOut: result.usage?.output, studentId });
  return { aiMarks: result.score, aiFeedback: [result.rationale, `confidence: ${result.confidence}`, result.needsReview ? "needs review" : ""].filter(Boolean).join(String.fromCharCode(10)).slice(0, 1000) };
}

/**
 * Writes an AI mark suggestion on one written exam answer. Only the teacher sees it (ExamAnswer.aiMarks); the
 * student's mark stays null until the teacher grades. False when AI gave nothing.
 */
export async function suggestAnswer(answerId: string): Promise<boolean> {
  const a = await db.examAnswer.findUnique({
    where: { id: answerId },
    select: { text: true, attempt: { select: { userId: true } }, item: { select: { kind: true, prompt: true, answer: true, marks: true, media: true } } },
  });
  if (!a || a.item.kind !== "WRITTEN") return false;
  const data = await markWritten(a.item, a.text, a.attempt.userId);
  if (!data) return false;
  await db.examAnswer.update({ where: { id: answerId }, data });
  return true;
}

/** Suggests a mark for every written answer of one submitted exam attempt. Returns how many got one. */
export async function suggestWritten(attemptId: string): Promise<number> {
  const answers = await db.examAnswer.findMany({ where: { attemptId, item: { kind: "WRITTEN" }, text: { not: null } }, select: { id: true } });
  let n = 0;
  for (const a of answers) if (await suggestAnswer(a.id).catch(() => false)) n += 1;
  return n;
}

/** The same for the written answers of one homework or quiz submission. Returns how many got a suggestion. */
export async function suggestSubmissionAnswers(submissionId: string): Promise<number> {
  const answers = await db.submissionAnswer.findMany({
    where: { submissionId, item: { kind: "WRITTEN" }, text: { not: null } },
    select: { id: true, text: true, submission: { select: { studentId: true } }, item: { select: { kind: true, prompt: true, answer: true, marks: true, media: true } } },
  });
  let n = 0;
  for (const a of answers) {
    const data = await markWritten(a.item, a.text, a.submission.studentId).catch(() => null);
    if (!data) continue;
    await db.submissionAnswer.update({ where: { id: a.id }, data });
    n += 1;
  }
  return n;
}
