"use client";

import { useActionState } from "react";
import { field, label } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { createItem, type BankError } from "./actions";

export function ItemForm({
  lessonId,
  labels,
}: {
  lessonId: string;
  labels: Record<"addQuestion" | "prompt" | "kind" | "mcq" | "short" | "answer" | "choices" | "correctIndex" | "explanation" | "marks" | "save" | "invalid" | "saved", string>;
}) {
  const [state, action] = useActionState(createItem, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="lessonId" value={lessonId} />

      <label className={label}>
        {labels.prompt}
        <textarea name="prompt" required rows={2} maxLength={2000} dir="auto" className={`${field} py-2`} />
      </label>

      <div className="flex flex-wrap items-end gap-3">
        <label className={label}>
          {labels.kind}
          <select name="kind" defaultValue="MCQ" className={field}>
            <option value="MCQ">{labels.mcq}</option>
            <option value="SHORT">{labels.short}</option>
          </select>
        </label>
        <label className={label}>
          {labels.marks}
          <input name="marks" type="number" min={1} max={100} defaultValue={1} dir="ltr" className={`${field} num w-20`} />
        </label>
      </div>

      <label className={label}>
        {labels.choices}
        <textarea name="choices" rows={3} dir="auto" className={`${field} py-2`} />
      </label>
      <label className={label}>
        {labels.correctIndex}
        <input name="correct" type="number" min={1} max={6} defaultValue={1} dir="ltr" className={`${field} num w-20`} />
      </label>

      <label className={label}>
        {labels.answer}
        <input name="answer" maxLength={1000} dir="auto" className={field} />
      </label>

      <label className={label}>
        {labels.explanation}
        <textarea name="explanation" rows={2} maxLength={4000} dir="auto" className={`${field} py-2`} />
      </label>

      {state === "invalid" && <p role="alert" className="text-small text-down">{labels.invalid}</p>}
      {state === "ok" && <p role="status" className="text-small text-up">{labels.saved}</p>}

      <SubmitButton className="btn btn-primary w-fit">{labels.addQuestion}</SubmitButton>
    </form>
  );
}
