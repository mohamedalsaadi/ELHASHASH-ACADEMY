"use client";

import { useActionState } from "react";
import { field } from "@/app/[locale]/admin/styles";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { PracticeError } from "@/lib/practice";

export type FormItem = { id: string; kind: "MCQ" | "SHORT" | "WRITTEN"; prompt: string; marks: number; choices: { id: string; label: string }[] };

type Labels = Record<"submit" | "choose" | "yourAnswer" | "invalid" | "closed" | "limited", string>;

/** One form for both a lesson's own practice and a mixed review set: the caller supplies the action. */
export function PracticeForm({
  action,
  lessonId,
  items,
  labels,
}: {
  action: (prev: PracticeError, form: FormData) => Promise<PracticeError>;
  lessonId?: string;
  items: FormItem[];
  labels: Labels;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="grid gap-5">
      {lessonId && <input type="hidden" name="lessonId" value={lessonId} />}

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
                  <input type="radio" name={`choice_${item.id}`} value={c.id} className="size-4" required />
                  <span dir="auto">{c.label}</span>
                </label>
              ))}
            </div>
          ) : (
            <input name={`text_${item.id}`} maxLength={1000} dir="auto" aria-label={labels.yourAnswer} placeholder={labels.yourAnswer} className={field} required />
          )}
        </fieldset>
      ))}

      {state && <p role="alert" className="text-small text-down">{labels[state]}</p>}

      <SubmitButton className="btn btn-primary w-fit">{labels.submit}</SubmitButton>
    </form>
  );
}
