// Practice marking. Pure, so the server action and the tests agree, and so a short answer written in
// Arabic with or without diacritics is marked the same way.

export type PracticeItem = {
  id: string;
  /** WRITTEN never appears in practice or review; it exists so exam answers share the type. */
  kind: "MCQ" | "SHORT" | "WRITTEN";
  marks: number;
  /** SHORT only: the canonical accepted answer. */
  answer: string | null;
  choices: { id: string; correct: boolean }[];
};

export type PracticeReply = { itemId: string; choiceId?: string | null; text?: string | null };

const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;

/**
 * Folds away what a student cannot be expected to type identically: vowel marks, tatweel, the alef and
 * ya variants, ta marbuta, Arabic-Indic digits, punctuation and spacing. It does not stem or strip "ال".
 */
export function normalizeAnswer(input: string): string {
  return input
    .replace(TASHKEEL, "")
    .replace(TATWEEL, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ئ/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .toLowerCase()
    .replace(/[.،,؛;:!?؟'"()\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** One item, one reply. A short answer must match the canonical answer exactly after normalising. */
export function gradeItem(item: PracticeItem, reply: PracticeReply | undefined): { correct: boolean; marks: number } {
  if (!reply || item.kind === "WRITTEN") return { correct: false, marks: 0 };
  if (item.kind === "MCQ") {
    const picked = item.choices.find((c) => c.id === reply.choiceId);
    const correct = !!picked?.correct;
    return { correct, marks: correct ? item.marks : 0 };
  }
  const expected = item.answer ? normalizeAnswer(item.answer) : "";
  const given = reply.text ? normalizeAnswer(reply.text) : "";
  const correct = expected.length > 0 && given === expected;
  return { correct, marks: correct ? item.marks : 0 };
}

export function scoreAttempt(items: PracticeItem[], replies: PracticeReply[]) {
  const byItem = new Map(replies.map((r) => [r.itemId, r]));
  const results = items.map((item) => ({ item, ...gradeItem(item, byItem.get(item.id)) }));
  return {
    results,
    marks: results.reduce((sum, r) => sum + r.marks, 0),
    maxMarks: items.reduce((sum, i) => sum + i.marks, 0),
    correct: results.filter((r) => r.correct).length,
  };
}

export type Mastery = "unseen" | "developing" | "secure";

/**
 * Mastery from the most recent answers only, so improvement shows. Two of the last three right is
 * "developing"; three of three is "secure". A single lucky answer never earns secure.
 */
export function masteryOf(recent: boolean[]): Mastery {
  if (recent.length === 0) return "unseen";
  const last = recent.slice(-3);
  const right = last.filter(Boolean).length;
  if (last.length >= 2 && right >= 2 && right === last.length) return "secure";
  return "developing";
}

/** What a practice or review submission can come back with. */
export type PracticeError = "invalid" | "closed" | "limited" | null;
