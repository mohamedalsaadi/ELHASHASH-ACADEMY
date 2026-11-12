"use client";

import { useActionState, useState } from "react";
import { Link } from "@/i18n/navigation";
import { UploadField } from "@/components/homework/UploadField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { field, label } from "@/components/ui/form";
import { QUIZ_TEMPLATE_URL } from "@/lib/quiz-template";
import type { AssignmentError } from "./actions";

export type CourseOption = { id: string; title: string; lessons: { id: string; title: string }[] };

export type AssignmentValues = {
  id?: string;
  courseId?: string;
  lessonId?: string | null;
  kind?: "HOMEWORK" | "QUIZ";
  title?: string;
  instructions?: string | null;
  linkUrl?: string | null;
  rubric?: string | null;
  dueAt?: string;
  maxScore?: number;
  allowResubmit?: boolean;
};

/** What the teacher is making. A quiz on Google Forms and a quiz of the site's own questions are both saved as kind QUIZ. */
type Type = "HOMEWORK" | "QUIZ" | "FORM";

type Labels = {
  course: string; lesson: string; lessonNone: string; title: string; instructions: string; linkUrl: string; rubric: string; due: string; maxScore: string; allowResubmit: string;
  files: string; attach: string; removeFile: string; uploadFailed: string; save: string; invalid: string;
  type?: string; typeHomework?: string; typeQuiz?: string; typeForm?: string; more?: string; template?: string; guide?: string;
  link?: string; linkHint?: string;
};

/** Only the fields that matter for the chosen type; everything else sits under "More options". */
export function AssignmentForm({
  mode,
  action,
  courses,
  values = {},
  labels,
}: {
  mode: "new" | "edit";
  action: (prev: AssignmentError, form: FormData) => Promise<AssignmentError>;
  courses: CourseOption[];
  values?: AssignmentValues;
  labels: Labels;
}) {
  const [state, formAction] = useActionState(action, null);
  const [courseId, setCourseId] = useState(values.courseId ?? courses[0]?.id ?? "");
  const [type, setType] = useState<Type>(values.kind === "QUIZ" ? (values.linkUrl ? "FORM" : "QUIZ") : "HOMEWORK");
  const lessons = courses.find((c) => c.id === courseId)?.lessons ?? [];
  const homework = type === "HOMEWORK";

  return (
    <form action={formAction} className="grid gap-4">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <input type="hidden" name="kind" value={homework ? "HOMEWORK" : "QUIZ"} />

      {mode === "new" && labels.type && (
        <fieldset className="grid gap-2">
          <legend className="text-label font-semibold text-ink-muted">{labels.type}</legend>
          <div className="flex flex-wrap gap-2">
            {([["HOMEWORK", labels.typeHomework], ["QUIZ", labels.typeQuiz], ["FORM", labels.typeForm]] as const).map(([k, text]) => (
              <label key={k} className={`flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-small ${type === k ? "border-pen bg-raised font-semibold text-pen" : "border-hairline text-ink-muted"} has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-pen`}>
                <input type="radio" name="type" value={k} checked={type === k} onChange={() => setType(k)} className="sr-only" />
                {text}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {mode === "new" && courses.length > 1 ? (
        <label className={label}>
          {labels.course}
          <select name="courseId" value={courseId} onChange={(e) => setCourseId(e.target.value)} className={field} required>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
      ) : (
        mode === "new" && <input type="hidden" name="courseId" value={courseId} />
      )}

      <label className={label}>
        {labels.title}
        <input name="title" defaultValue={values.title ?? ""} required maxLength={200} dir="auto" className={field} />
      </label>

      {type === "FORM" && (
        <label className={label}>
          {labels.linkUrl}
          <input name="linkUrl" type="url" pattern="https://.*" defaultValue={values.linkUrl ?? ""} required maxLength={500} dir="ltr" placeholder="https://" className={field} />
          {labels.linkHint && <span className="text-label font-normal text-ink-muted">{labels.linkHint}</span>}
          <span className="flex flex-wrap gap-x-4 gap-y-1 text-label font-normal">
            {labels.template && <a href={QUIZ_TEMPLATE_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{labels.template}</a>}
            {labels.guide && <Link href="/teacher/guide/google-forms" className="underline underline-offset-4">{labels.guide}</Link>}
          </span>
        </label>
      )}

      {homework && (
        <label className={label}>
          {labels.instructions}
          <textarea name="instructions" defaultValue={values.instructions ?? ""} maxLength={8000} rows={4} dir="auto" className={`${field} py-2`} />
        </label>
      )}

      <label className={label}>
        {labels.due}
        <input name="dueAt" type="datetime-local" defaultValue={values.dueAt ?? ""} className={`${field} w-fit`} />
      </label>

      {homework && (
        <UploadField
          pathPrefix={`homework/${courseId}/`}
          clientPayload={JSON.stringify({ purpose: "assignment", courseId })}
          max={5}
          label={labels.files}
          failedLabel={labels.uploadFailed}
          removeLabel={labels.removeFile}
        />
      )}

      <details className="grid gap-4 rounded-md border border-hairline p-3">
        <summary className="cursor-pointer text-small font-semibold text-ink-muted">{labels.more ?? labels.maxScore}</summary>
        <div className="mt-3 grid gap-4">
          {mode === "new" && (
            <label className={label}>
              {labels.lesson}
              <select name="lessonId" defaultValue={values.lessonId ?? ""} className={field}>
                <option value="">{labels.lessonNone}</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!homework && type !== "FORM" && (
            <label className={label}>
              {labels.instructions}
              <textarea name="instructions" defaultValue={values.instructions ?? ""} maxLength={8000} rows={3} dir="auto" className={`${field} py-2`} />
            </label>
          )}
          {homework && (
            <label className={label}>
              {labels.linkUrl}
              <input name="linkUrl" type="url" pattern="https://.*" defaultValue={values.linkUrl ?? ""} maxLength={500} dir="ltr" placeholder="https://" className={field} />
            </label>
          )}
          {homework && (
            <label className={label}>
              {labels.rubric}
              <textarea name="rubric" defaultValue={values.rubric ?? ""} maxLength={4000} rows={3} dir="auto" className={`${field} py-2`} />
            </label>
          )}
          <div className="flex flex-wrap items-end gap-4">
            <label className={label}>
              {labels.maxScore}
              <input name="maxScore" type="number" min={1} max={1000} defaultValue={values.maxScore ?? 100} required dir="ltr" className={`${field} num w-28`} />
            </label>
            {type !== "FORM" && (
              <label className="flex min-h-11 items-center gap-2 text-label text-ink-muted">
                <input type="checkbox" name="allowResubmit" defaultChecked={values.allowResubmit ?? false} className="size-4" />
                {labels.allowResubmit}
              </label>
            )}
          </div>
        </div>
      </details>

      {state && <p role="alert" className="text-small text-down">{(labels as Record<string, string | undefined>)[state] ?? labels.invalid}</p>}

      <SubmitButton className="btn btn-primary w-fit">{labels.save}</SubmitButton>
    </form>
  );
}
