"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { field } from "@/components/ui/form";
import { submitReview, type ReviewState } from "./actions";

type Labels = { stars: string; text: string; send: string; ok: string; held: string; closed: string; masked: string; invalid: string; already: string };

/** One to five as numbered pills (DESIGN.md prefers a number to a star icon), plus an optional written review. */
export function ReviewForm({ courseId, initial, labels }: { courseId: string; initial: { stars: number; text: string | null } | null; labels: Labels }) {
  const [state, action] = useActionState(submitReview, null as ReviewState);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="courseId" value={courseId} />
      <fieldset className="grid gap-2">
        <legend className="text-label font-semibold text-ink-muted">{labels.stars}</legend>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-pen rounded-full">
              <input type="radio" name="stars" value={n} defaultChecked={initial?.stars === n} required className="peer sr-only" />
              <span className="num flex size-11 cursor-pointer items-center justify-center rounded-full border border-hairline text-body text-ink-muted peer-checked:border-pen peer-checked:bg-raised peer-checked:font-semibold peer-checked:text-pen">{n}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-1 text-label font-semibold text-ink-muted">
        {labels.text}
        <textarea name="text" defaultValue={initial?.text ?? ""} maxLength={1500} rows={3} dir="auto" className={`${field} py-2 font-normal`} />
      </label>
      <SubmitButton showSaved={false} className="btn btn-primary w-fit">{labels.send}</SubmitButton>
      {state && <p role={state === "ok" || state === "held" ? "status" : "alert"} className={`text-small ${state === "ok" || state === "held" ? "text-ink-muted" : "text-down"}`}>{labels[state]}</p>}
    </form>
  );
}
