"use client";

import { useActionState } from "react";
import { field, label } from "@/app/[locale]/admin/styles";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { createSpecialRequest } from "@/lib/request-actions";

export function RequestForm({
  kids,
  courses,
  labels,
}: {
  kids: { id: string; name: string }[];
  courses: Record<string, { id: string; title: string }[]>;
  labels: { child: string; course: string; lessonNone: string; subject: string; body: string; send: string; ok: string; masked: string; invalid: string; limited: string; unlinked: string };
}) {
  const [state, action] = useActionState(createSpecialRequest, null);
  return (
    <form action={action} className="grid gap-3">
      <label className={label}>
        {labels.child}
        <select name="studentId" className={field} required>
          {kids.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        {labels.course}
        <select name="courseId" className={field}>
          <option value="">{labels.lessonNone}</option>
          {kids.map((c) => (
            <optgroup key={c.id} label={c.name}>
              {(courses[c.id] ?? []).map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className={label}>
        {labels.subject}
        <input name="subject" required maxLength={160} dir="auto" className={field} />
      </label>
      <label className={label}>
        {labels.body}
        <textarea name="body" required rows={4} maxLength={4000} dir="auto" className={`${field} py-2`} />
      </label>
      {state && state !== "ok" && state !== "masked" && (
        <p role="alert" className="text-small text-down">{labels[state] ?? labels.invalid}</p>
      )}
      {(state === "ok" || state === "masked") && (
        <p role="status" className="text-small text-up">{state === "masked" ? labels.masked : labels.ok}</p>
      )}
      <SubmitButton className="btn btn-primary w-fit">{labels.send}</SubmitButton>
    </form>
  );
}
