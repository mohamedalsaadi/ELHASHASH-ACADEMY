"use client";

import { useActionState } from "react";
import { UploadField } from "@/components/homework/UploadField";
import { QuestionFields, type FormItem, type QuestionLabels } from "@/components/QuestionFields";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { field, label } from "@/components/ui/form";
import { submitAssignment, type SubmitError } from "./actions";

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
      {items.length > 0 && <p className="text-label text-ink-muted">{labels.extra}</p>}
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
      {state && (
        <p role={state === "ok" || state === "masked" ? "status" : "alert"} className={`text-small ${state === "ok" || state === "masked" ? "text-up" : "text-down"}`}>
          {labels[state]}
        </p>
      )}
      <SubmitButton showSaved={false} className="btn btn-primary w-fit">{labels.submit}</SubmitButton>
    </form>
  );
}
