"use client";

import { useActionState, useEffect, useRef } from "react";
import { ExamTimer } from "@/components/exam/ExamTimer";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { field } from "@/components/ui/form";
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
  const form = useRef<HTMLFormElement>(null);
  const key = `exam:${attemptId}`;

  // Answers are kept in this browser as the student goes, so a refresh or a dropped connection costs nothing.
  useEffect(() => {
    const el = form.current;
    if (!el) return;
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, string>;
      for (const [name, value] of Object.entries(saved)) {
        for (const input of Array.from(el.elements).filter((x): x is HTMLInputElement | HTMLTextAreaElement => (x as HTMLInputElement).name === name)) {
          if (input instanceof HTMLInputElement && input.type === "radio") input.checked = input.value === value;
          else input.value = value;
        }
      }
    } catch {}
  }, [key]);

  function save() {
    const el = form.current;
    if (!el) return;
    const out: Record<string, string> = {};
    for (const [name, value] of new FormData(el)) if (/^(choice|text)_/.test(name) && typeof value === "string" && value) out[name] = value;
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
