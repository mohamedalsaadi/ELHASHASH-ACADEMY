"use client";

import { useActionState } from "react";
import { field } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { RequestError } from "@/lib/request-actions";

/** One reply box, used by parents and by staff; the action decides who may post. */
export function ReplyForm({
  action,
  requestId,
  labels,
}: {
  action: (prev: RequestError, form: FormData) => Promise<RequestError>;
  requestId: string;
  labels: { placeholder: string; send: string; ok: string; invalid: string; limited: string; masked?: string; unlinked?: string };
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="id" value={requestId} />
      <textarea name="body" rows={2} maxLength={4000} dir="auto" aria-label={labels.placeholder} placeholder={labels.placeholder} className={`${field} py-2`} />
      {state && state !== "ok" && <p role="alert" className="text-small text-down">{labels[state] ?? labels.invalid}</p>}
      {state === "ok" && <p role="status" className="text-small text-up">{labels.ok}</p>}
      <SubmitButton className="btn btn-outline w-fit px-4 py-2 text-small">{labels.send}</SubmitButton>
    </form>
  );
}
