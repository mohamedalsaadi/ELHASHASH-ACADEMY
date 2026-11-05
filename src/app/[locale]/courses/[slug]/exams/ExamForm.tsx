"use client";

import { useActionState } from "react";
import { ExamTimer } from "@/components/exam/ExamTimer";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { field } from "@/app/[locale]/admin/styles";
import { submitExam } from "@/app/[locale]/courses/[slug]/exams/actions";
import type { PracticeError } from "@/lib/practice";

export type ExamFormItem = { id: string; kind: "MCQ" | "SHORT" | "WRITTEN"; prompt: string; marks: number; choices: { id: string; label: string }[] };

export function ExamForm({
  attemptId,
  expiresAt,
  items,
  labels,
}: {
  attemptId: string;
  expiresAt: string;
  items: ExamFormItem[];
  labels: Record<"submit" | "yourAnswer" | "invalid" | "closed" | "limited" | "timeLeft" | "timeUp", string>;
}) {
  const [state, action] = useActionState(submitExam, null as PracticeError);
  return (
    <form action={action} data-exam className="grid gap-5">
      <input type="hidden" name="attemptId" value={attemptId} />
      <ExamTimer at={expiresAt} label={labels.timeLeft} timeUp={labels.timeUp} />

      {items.map((item, i) => (
        <fieldset key={item.id} className="grid gap-2 card p-4">
          {/* The legend carries the prompt so a screen reader names the group, not just "1 · 2". */}
          <legend className="grid gap-1 px-1">
            <span className="text-label text-ink-muted"><span className="num">{i + 1}</span> · <span className="num">{item.marks}</span></span>
            <span className="font-semibold" dir="auto">{item.prompt}</span>
          </legend>

          {item.kind === "MCQ" ? (
            <div className="grid gap-1.5">
              {item.choices.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-small">
                  <input type="radio" name={`choice_${item.id}`} value={c.id} className="size-4" />
                  <span dir="auto">{c.label}</span>
                </label>
              ))}
            </div>
          ) : item.kind === "WRITTEN" ? (
            <textarea name={`text_${item.id}`} rows={4} maxLength={2000} dir="auto" aria-label={labels.yourAnswer} placeholder={labels.yourAnswer} className={`${field} py-2`} />
          ) : (
            <input name={`text_${item.id}`} maxLength={1000} dir="auto" aria-label={labels.yourAnswer} placeholder={labels.yourAnswer} className={field} />
          )}
        </fieldset>
      ))}

      {state && <p role="alert" className="text-small text-down">{labels[state]}</p>}

      <SubmitButton className="btn btn-primary w-fit">{labels.submit}</SubmitButton>
    </form>
  );
}
