"use client";

import { useActionState, useEffect, useRef } from "react";
import { ExamTimer } from "@/components/exam/ExamTimer";
import { QuestionPages } from "@/components/QuestionPages";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { field } from "@/components/ui/form";
import { submitExam } from "@/app/[locale]/courses/[slug]/exams/actions";
import type { PracticeError } from "@/lib/practice";

export type ExamFormItem = { id: string; kind: "MCQ" | "MULTI" | "SHORT" | "WRITTEN"; prompt: string; marks: number; choices: { id: string; label: string }[]; mediaCount?: number };

export function ExamForm({
  attemptId,
  expiresAt,
  items,
  labels,
}: {
  attemptId: string;
  expiresAt: string;
  items: ExamFormItem[];
  labels: Record<"submit" | "yourAnswer" | "invalid" | "closed" | "limited" | "timeLeft" | "timeUp" | "pictureAlt" | "pickAll", string>;
}) {
  const [state, action] = useActionState(submitExam, null as PracticeError);
  const form = useRef<HTMLFormElement>(null);
  const key = `exam:${attemptId}`;

  // Answers are kept in this browser as the student goes, so a refresh or a dropped connection costs nothing.
  useEffect(() => {
    const el = form.current;
    if (!el) return;
    try {
      // A value is a string, or a list of strings for a question with several ticked boxes.
      const saved = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, string | string[]>;
      for (const [name, value] of Object.entries(saved)) {
        const values = ([] as string[]).concat(value);
        for (const input of Array.from(el.elements).filter((x): x is HTMLInputElement | HTMLTextAreaElement => (x as HTMLInputElement).name === name)) {
          if (input instanceof HTMLInputElement && (input.type === "radio" || input.type === "checkbox")) input.checked = values.includes(input.value);
          else input.value = values[0] ?? "";
        }
      }
    } catch {}
  }, [key]);

  function save() {
    const el = form.current;
    if (!el) return;
    const out: Record<string, string[]> = {};
    for (const [name, value] of new FormData(el)) if (/^(choice|text)_/.test(name) && typeof value === "string" && value) (out[name] ??= []).push(value);
    try {
      localStorage.setItem(key, JSON.stringify(out));
    } catch {}
  }

  return (
    <form ref={form} action={action} onChange={save} onInput={save} data-exam className="grid gap-5">
      <input type="hidden" name="attemptId" value={attemptId} />
      <ExamTimer at={expiresAt} label={labels.timeLeft} timeUp={labels.timeUp} />

      {items.map((item, i) => (
        <fieldset key={item.id} className="grid gap-2 card p-4">
          {/* The legend carries the prompt so a screen reader names the group, not just "1 · 2". */}
          <legend className="grid gap-1 px-1">
            <span className="text-label text-ink-muted"><span className="num">{i + 1}</span> · <span className="num">{item.marks}</span></span>
            <span className="font-semibold" dir="auto">{item.prompt}</span>
          </legend>

          <QuestionPages itemId={item.id} count={item.mediaCount ?? 0} label={labels.pictureAlt} />
          {item.kind === "MCQ" || item.kind === "MULTI" ? (
            <div className="grid gap-1.5">
              {item.kind === "MULTI" && <span className="text-label text-ink-muted">{labels.pickAll}</span>}
              {item.choices.map((c, ci) => (
                <label key={c.id} className="flex items-center gap-2 text-small">
                  <input type={item.kind === "MCQ" ? "radio" : "checkbox"} name={`choice_${item.id}`} value={c.id} className="size-4" />
                  <span className="num w-4 text-label font-semibold" dir="ltr">{"ABCDEF"[ci]}</span>
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
