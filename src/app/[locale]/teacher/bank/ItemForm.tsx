"use client";

import { useActionState, useState } from "react";
import { field, label } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { QuestionMedia } from "@/components/teacher/QuestionMedia";
import { createItem, updateItem, type BankError } from "./actions";

type Kind = "MCQ" | "MULTI" | "SHORT" | "WRITTEN";
export type EditableItem = {
  id: string;
  kind: Kind;
  prompt: string;
  answer: string | null;
  explanation: string | null;
  marks: number;
  media: string[];
  choices: { label: string; correct: boolean }[];
};
type Labels = Record<
  | "addQuestion" | "prompt" | "kind" | "mcq" | "multi" | "short" | "written" | "answer" | "explanation" | "marks" | "save" | "invalid" | "saved"
  | "optionLetter" | "tickCorrect" | "mediaPick" | "mediaSending" | "mediaFailed" | "mediaRemove" | "mediaPages",
  string
>;

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/**
 * A question: typed, a picture or a PDF, or both. Options are lettered rows; one tick for a single answer, several for a
 * multiple-answer question. With `item` it edits that question instead of adding one.
 */
export function ItemForm({ lessonId, courseId, labels, item }: { lessonId: string; courseId: string; labels: Labels; item?: EditableItem }) {
  const blank = () => {
    const given = item?.choices ?? [];
    return Array.from({ length: Math.max(4, given.length) }, (_, i) => ({ label: given[i]?.label ?? "", correct: given[i]?.correct ?? (!item && i === 0) }));
  };
  const [kind, setKind] = useState<Kind>(item?.kind ?? "MCQ");
  const [rows, setRows] = useState(blank);
  const [mediaKey, setMediaKey] = useState(0);
  const [state, action] = useActionState(async (prev: BankError, form: FormData) => {
    const result = await (item ? updateItem : createItem)(prev, form);
    // A new question starts from an empty form: the options and the picture belong to the one just saved.
    if (result === "ok" && !item) { setKind("MCQ"); setRows(blank()); setMediaKey((k) => k + 1); }
    return result;
  }, null as BankError);
  const choiceKind = kind === "MCQ" || kind === "MULTI";
  const set = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="lessonId" value={lessonId} />
      {item && <input type="hidden" name="id" value={item.id} />}

      <label className={label}>
        {labels.prompt}
        <textarea name="prompt" rows={2} maxLength={2000} dir="auto" defaultValue={item?.prompt} className={`${field} py-2`} />
      </label>

      <QuestionMedia
        key={mediaKey}
        courseId={courseId}
        defaultMedia={item?.media}
        labels={{ pick: labels.mediaPick, sending: labels.mediaSending, failed: labels.mediaFailed, remove: labels.mediaRemove, pages: labels.mediaPages }}
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className={label}>
          {labels.kind}
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={field}>
            <option value="MCQ">{labels.mcq}</option>
            <option value="MULTI">{labels.multi}</option>
            <option value="SHORT">{labels.short}</option>
            <option value="WRITTEN">{labels.written}</option>
          </select>
        </label>
        <label className={label}>
          {labels.marks}
          <input name="marks" type="number" min={1} max={100} defaultValue={item?.marks ?? 1} dir="ltr" className={`${field} num w-20`} />
        </label>
      </div>

      {choiceKind && (
        <fieldset className="grid gap-2">
          <legend className="text-label text-ink-muted">{labels.tickCorrect}</legend>
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type={kind === "MCQ" ? "radio" : "checkbox"}
                name="correct"
                value={i}
                checked={r.correct}
                onChange={(e) => (kind === "MCQ" ? setRows((all) => all.map((x, j) => ({ ...x, correct: j === i }))) : set(i, { correct: e.target.checked }))}
                aria-label={`${labels.optionLetter} ${LETTERS[i]}`}
                className="size-5 shrink-0"
              />
              <span className="num w-5 shrink-0 text-label font-semibold" dir="ltr">{LETTERS[i]}</span>
              <input name="choice" value={r.label} maxLength={500} dir="auto" onChange={(e) => set(i, { label: e.target.value })} className={`${field} flex-1`} />
            </div>
          ))}
          {rows.length < 6 && (
            <button type="button" onClick={() => setRows((r) => [...r, { label: "", correct: false }])} className="w-fit text-label underline underline-offset-4">
              + {labels.optionLetter} {LETTERS[rows.length]}
            </button>
          )}
        </fieldset>
      )}

      {!choiceKind && (
        <label className={label}>
          {labels.answer}
          <input name="answer" maxLength={1000} dir="auto" defaultValue={item?.answer ?? ""} className={field} />
        </label>
      )}

      <label className={label}>
        {labels.explanation}
        <textarea name="explanation" rows={2} maxLength={4000} dir="auto" defaultValue={item?.explanation ?? ""} className={`${field} py-2`} />
      </label>

      {state === "invalid" && <p role="alert" className="text-small text-down">{labels.invalid}</p>}
      {state === "ok" && <p role="status" className="text-small text-up">{labels.saved}</p>}

      <SubmitButton className="btn btn-primary w-fit">{item ? labels.save : labels.addQuestion}</SubmitButton>
    </form>
  );
}
