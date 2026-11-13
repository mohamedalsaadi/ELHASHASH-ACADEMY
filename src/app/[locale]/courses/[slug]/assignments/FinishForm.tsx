"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { confirmFinished, type FinishState } from "./actions";

/** The one button of a quiz on Google Forms: "I finished". Asks nothing else of the student. */
export function FinishForm({ assignmentId, labels }: { assignmentId: string; labels: { finish: string; closed: string; notOpened: string } }) {
  const [state, action] = useActionState(confirmFinished, null as FinishState);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <SubmitButton showSaved={false} className="btn btn-primary w-fit">{labels.finish}</SubmitButton>
      {(state === "closed" || state === "notOpened") && <p role="alert" className="text-small text-down">{labels[state]}</p>}
    </form>
  );
}
