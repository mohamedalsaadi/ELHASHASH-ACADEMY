"use client";

import { useActionState } from "react";
import { field, label } from "@/components/ui/form";
import { gradeSubmission } from "../actions";

export function GradeForm({
  id,
  maxScore,
  score,
  feedback,
  labels,
}: {
  id: string;
  maxScore: number;
  score: number | null;
  feedback: string | null;
  labels: {
    invalid: string;
    invalid_score: string;
    feedback_required: string;
    ok: string;
    score: string;
    feedback: string;
    saveGrade: string;
    returnToStudent: string;
  };
}) {
  const [state, action] = useActionState(gradeSubmission, null);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-end gap-3">
        <label className={label}>
          {labels.score}
          <input name="score" type="number" min={0} max={maxScore} defaultValue={score ?? ""} dir="ltr" className={`${field} num w-24`} />
        </label>
        <span className="num pb-3 text-label text-ink-muted">/ {maxScore}</span>
      </div>
      <label className={label}>
        {labels.feedback}
        <textarea name="feedback" defaultValue={feedback ?? ""} rows={2} maxLength={4000} dir="auto" className={`${field} py-2`} />
      </label>
      {state && state !== "ok" && (
        <p role="alert" className="text-small text-down">
          {labels[state]}
        </p>
      )}
      {state === "ok" && (
        <p role="status" className="text-small text-up">
          {labels.ok}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button name="mode" value="grade" className="btn btn-primary px-4 py-2 text-small">
          {labels.saveGrade}
        </button>
        <button name="mode" value="return" className="btn btn-outline px-4 py-2 text-small">
          {labels.returnToStudent}
        </button>
      </div>
    </form>
  );
}
