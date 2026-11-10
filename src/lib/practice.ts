// Practice marking. Pure, so the server action and the tests agree, and so a short answer written in
// Arabic with or without diacritics is marked the same way.

export type PracticeItem = {
  id: string;
  /** WRITTEN never appears in practice or review; it exists so exam answers share the type. */
  kind: "MCQ" | "MULTI" | "SHORT" | "WRITTEN";
  marks: number;
  /** SHORT only: the canonical accepted answer. */
  answer: string | null;
  choices: { id: string; correct: boolean }[];
};

/** `choiceId` answers an MCQ; `choiceIds` is every box ticked on a MULTI question. */
export type PracticeReply = { itemId: string; choiceId?: string | null; choiceIds?: string[]; text?: string | null };

/** One item's answer out of a submitted form: `choice_<id>` is one value for a radio and several for ticked boxes. */
export function replyFrom(form: FormData, itemId: string): PracticeReply {
  const ids = form.getAll(`choice_${itemId}`).map(String).filter(Boolean);
  return { itemId, choiceId: ids[0] ?? null, choiceIds: ids, text: String(form.get(`text_${itemId}`) ?? "") || null };
}

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
  if (item.kind === "MULTI") {
    // Right only when exactly the correct set is ticked: a missed or an extra box is wrong (no part marks, easy to explain).
    const want = new Set(item.choices.filter((c) => c.correct).map((c) => c.id));
    const got = new Set((reply.choiceIds ?? []).filter((id) => item.choices.some((c) => c.id === id)));
    const correct = want.size > 0 && got.size === want.size && [...want].every((id) => got.has(id));
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

/** What a practice or review submission can come back with. */
export type PracticeError = "invalid" | "closed" | "limited" | null;
