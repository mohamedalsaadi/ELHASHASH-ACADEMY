"use client";

import { useActionState } from "react";
import { UploadField } from "@/components/homework/UploadField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { field, label } from "@/app/[locale]/admin/styles";
import { submitAssignment, type SubmitError } from "./actions";

export function SubmitForm({
  assignmentId,
  studentId,
  labels,
}: {
  assignmentId: string;
  studentId: string;
  labels: Record<Exclude<SubmitError, null>, string> & { answer: string; hint: string; submit: string; attach: string; removeFile: string; uploadFailed: string };
}) {
  const [state, action] = useActionState(submitAssignment, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <label className={label}>
        {labels.answer}
        <textarea name="text" rows={5} maxLength={10000} dir="auto" placeholder={labels.hint} className={`${field} py-2`} />
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
      <SubmitButton className="btn btn-primary w-fit">{labels.submit}</SubmitButton>
    </form>
  );
}
