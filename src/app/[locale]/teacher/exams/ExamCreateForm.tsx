"use client";

import { useActionState } from "react";
import { field, label } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { createExam, type ExamError } from "./actions";

export function ExamCreateForm({ courses, labels }: { courses: { id: string; title: string }[]; labels: Record<"name" | "duration" | "create" | "invalid", string> }) {
  const [state, action] = useActionState(createExam, null as ExamError);
  return (
    <form action={action} className="grid gap-3">
      <label className={label}>
        {labels.name}
        <input name="title" required maxLength={200} dir="auto" className={field} />
      </label>
      <label className={label}>
        {labels.duration}
        <input name="durationMin" type="number" min={5} max={300} defaultValue={60} dir="ltr" className={`${field} num w-28`} />
      </label>
      <label className={label}>
        <span className="sr-only">{labels.name}</span>
        <select name="courseId" required className={field}>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>
      {state === "invalid" && <p role="alert" className="text-small text-down">{labels.invalid}</p>}
      <SubmitButton className="btn btn-primary w-fit">{labels.create}</SubmitButton>
    </form>
  );
}
