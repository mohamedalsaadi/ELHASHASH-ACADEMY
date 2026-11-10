"use client";

import { useActionState } from "react";
import { QuestionFields, type FormItem } from "@/components/QuestionFields";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { PracticeError } from "@/lib/practice";

export type { FormItem };

type Labels = Record<"submit" | "choose" | "yourAnswer" | "invalid" | "closed" | "limited" | "pictureAlt" | "pickAll", string>;

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

      <QuestionFields items={items} labels={labels} required />

      {state && <p role="alert" className="text-small text-down">{labels[state]}</p>}

      <SubmitButton className="btn btn-primary w-fit">{labels.submit}</SubmitButton>
    </form>
  );
}
