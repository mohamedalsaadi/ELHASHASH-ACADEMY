// Exam marking. Objective items mark themselves; a written answer is left null for the teacher.
import type { PracticeItem, PracticeReply } from "./practice";
import { gradeItem } from "./practice";

export type ExamItemLike = PracticeItem;

/** A submit that lands just after the clock still counts: phones, tunnels and slow taps are not cheating. */
export const SUBMIT_GRACE_MS = 60_000;

export function isExpired(expiresAt: Date, now: Date, graceMs = SUBMIT_GRACE_MS): boolean {
  return now.getTime() > expiresAt.getTime() + graceMs;
}

/**
 * Marks what can be marked. `needsGrading` is true when at least one written answer is waiting, which keeps
 * the attempt in SUBMITTED rather than GRADED until a teacher has seen it.
 */
export function markExam(items: ExamItemLike[], replies: PracticeReply[]) {
  const byItem = new Map(replies.map((r) => [r.itemId, r]));
  const results = items.map((item) => {
    const reply = byItem.get(item.id);
    if (item.kind === "WRITTEN") return { itemId: item.id, correct: null, marks: null };
    const graded = gradeItem(item, reply);
    return { itemId: item.id, correct: graded.correct, marks: graded.marks };
  });
  return {
    results,
    autoMarks: results.reduce((sum, r) => sum + (r.marks ?? 0), 0),
    maxMarks: items.reduce((sum, i) => sum + i.marks, 0),
    needsGrading: results.some((r) => r.correct === null),
  };
}

/** Small deterministic PRNG so an attempt keeps one order across refreshes but each student gets their own. */
function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(list: T[], seed: string): T[] {
  const out = [...list];
  const rand = seeded(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Bulk question import, one question per line: `prompt | choice;choice;choice | correct number (or 1,3 for several) | marks`.
 * With no choices the third column is the accepted short answer. Returns the good rows and the 1-based bad line numbers.
 */
export type ImportedQuestion =
  | { kind: "MCQ"; prompt: string; choices: string[]; correct: number; marks: number }
  | { kind: "MULTI"; prompt: string; choices: string[]; correct: number[]; marks: number }
  | { kind: "SHORT"; prompt: string; answer: string; marks: number };

export function parseQuestionCsv(text: string) {
  const rows: ImportedQuestion[] = [];
  const bad: number[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const [prompt = "", choicesRaw = "", third = "", marksRaw = ""] = line.split("|").map((s) => s.trim());
    const marks = marksRaw ? Number(marksRaw) : 1;
    if (prompt.length < 3 || !Number.isInteger(marks) || marks < 1 || marks > 100) return void bad.push(i + 1);
    const choices = choicesRaw.split(";").map((s) => s.trim()).filter(Boolean).slice(0, 6);
    if (choices.length === 0) {
      if (!third) return void bad.push(i + 1);
      rows.push({ kind: "SHORT", prompt, answer: third, marks });
      return;
    }
    // "2" is one right answer; "1,3" is several (a MULTI question).
    const picks = [...new Set(third.split(",").map((s) => Number(s.trim())))];
    if (choices.length < 2 || picks.some((n) => !Number.isInteger(n) || n < 1 || n > choices.length)) return void bad.push(i + 1);
    if (picks.length > 1) rows.push({ kind: "MULTI", prompt, choices, correct: picks, marks });
    else rows.push({ kind: "MCQ", prompt, choices, correct: picks[0], marks });
  });
  return { rows, bad };
}

/** A quiz's marks scaled to the assignment's maximum score (a 4/5 quiz on a 100-point assignment is 80). */
export function scaleScore(marks: number, maxMarks: number, maxScore: number): number {
  return maxMarks > 0 ? Math.min(maxScore, Math.max(0, Math.round((marks / maxMarks) * maxScore))) : 0;
}

/** The two fixed options of a true/false question (saved as a one-answer multiple-choice question). */
export const TRUE_FALSE_LABELS = ["صح (True)", "خطأ (False)"] as const;
