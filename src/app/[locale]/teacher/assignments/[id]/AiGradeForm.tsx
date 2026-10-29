"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { gradeWithAi, type AiError } from "../actions";

/** Asks the model for a suggestion. Nothing is applied to the grade; the teacher still confirms. */
export function AiGradeForm({
  id,
  labels,
}: {
  id: string;
  labels: Record<Exclude<AiError, null> | "aiGrade", string>;
}) {
  const [state, action] = useActionState(gradeWithAi, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="btn btn-outline px-3 py-1.5 text-small">{labels.aiGrade}</SubmitButton>
      {state && state !== "ok" && <span role="alert" className="text-small text-down">{labels[state]}</span>}
    </form>
  );
}
