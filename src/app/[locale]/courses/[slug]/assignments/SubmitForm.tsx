"use client";

import { useActionState, type ReactNode } from "react";
import { UploadField } from "@/components/homework/UploadField";
import { QuestionFields, type FormItem, type QuestionLabels } from "@/components/QuestionFields";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { field, label } from "@/components/ui/form";
import { submitAssignment, type SubmitError } from "./actions";

/** With questions, the optional notes and photo sit behind one line; plain homework shows them as the answer. */
function Extra({ fold, summary, children }: { fold: boolean; summary: string; children: ReactNode }) {
  if (!fold) return <>{children}</>;
  return (
    <details className="rounded-md border border-hairline p-3">
      <summary className="cursor-pointer text-small text-ink-muted">{summary}</summary>
      <div className="mt-3 grid gap-3">{children}</div>
    </details>
  );
}

export function SubmitForm({
  assignmentId,
  studentId,
  items = [],
  labels,
}: {
  assignmentId: string;
  studentId: string;
  /** Bank questions set on this assignment; with none it is plain homework (text and files). */
  items?: FormItem[];
  labels: Record<Exclude<SubmitError, null>, string> & QuestionLabels & { answer: string; hint: string; submit: string; attach: string; removeFile: string; uploadFailed: string; extra: string };
}) {
  const [state, action] = useActionState(submitAssignment, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      {items.length > 0 && <QuestionFields items={items} labels={labels} />}
      <Extra fold={items.length > 0} summary={labels.extra}>
        <label className={label}>
          {items.length > 0 ? null : labels.answer}
          <textarea name="text" aria-label={labels.answer} rows={5} maxLength={10000} dir="auto" placeholder={labels.hint} className={`${field} py-2`} />
        </label>
        <UploadField
          pathPrefix={`submissions/${assignmentId}/${studentId}/`}
          clientPayload={JSON.stringify({ purpose: "submission", assignmentId })}
          max={5}
          label={labels.attach}
          failedLabel={labels.uploadFailed}
          removeLabel={labels.removeFile}
        />
      </Extra>
      {state && (
        <p role={state === "ok" || state === "masked" ? "status" : "alert"} className={`text-small ${state === "ok" || state === "masked" ? "text-up" : "text-down"}`}>
          {labels[state]}
        </p>
      )}
      <SubmitButton showSaved={false} className="btn btn-primary w-fit">{labels.submit}</SubmitButton>
    </form>
  );
}
