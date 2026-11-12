"use client";

import { useActionState } from "react";
import { field, label } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { importItems } from "./actions";

/** Pastes many questions at once. With a `lessonId` they go to that lesson; without one they belong to the course only. */
export function ImportForm({ courseId, lessonId, labels }: { courseId: string; lessonId?: string; labels: Record<"importHint" | "importBtn" | "invalid" | "saved", string> }) {
  const [state, action] = useActionState(importItems, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="courseId" value={courseId} />
      {lessonId && <input type="hidden" name="lessonId" value={lessonId} />}
      <label className={label}>
        {labels.importHint}
        <textarea name="csv" required rows={6} dir="auto" className={`${field} py-2 font-mono`} placeholder="2 + 2 = ? | 3;4;5 | 2 | 1" />
      </label>
      {state === "invalid" && <p role="alert" className="text-small text-down">{labels.invalid}</p>}
      {state === "ok" && <p role="status" className="text-small text-up">{labels.saved}</p>}
      <SubmitButton className="btn btn-outline w-fit">{labels.importBtn}</SubmitButton>
    </form>
  );
}
