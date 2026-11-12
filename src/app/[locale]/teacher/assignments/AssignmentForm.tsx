"use client";

import { useActionState, useState } from "react";
import { UploadField } from "@/components/homework/UploadField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { field, label } from "@/components/ui/form";
import type { AssignmentError } from "./actions";

export type CourseOption = { id: string; title: string; lessons: { id: string; title: string }[] };

export type AssignmentValues = {
  id?: string;
  courseId?: string;
  lessonId?: string | null;
  title?: string;
  instructions?: string | null;
  linkUrl?: string | null;
  rubric?: string | null;
  dueAt?: string;
  maxScore?: number;
  allowResubmit?: boolean;
};

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
  labels: { course: string; lesson: string; lessonNone: string; title: string; instructions: string; linkUrl: string; rubric: string; due: string; maxScore: string; allowResubmit: string; files: string; attach: string; removeFile: string; uploadFailed: string; save: string; invalid: string; kind?: string; kindHomework?: string; kindQuiz?: string; link?: string; linkHint?: string };
}) {
  const [state, formAction] = useActionState(action, null);
  const [courseId, setCourseId] = useState(values.courseId ?? courses[0]?.id ?? "");
  const lessons = courses.find((c) => c.id === courseId)?.lessons ?? [];

  return (
    <form action={formAction} className="grid gap-4">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <label className={label}>
        {labels.course}
        <select
          name="courseId"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          disabled={mode === "edit"}
          className={field}
          required
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>

      {mode === "new" && labels.kind && (
        <label className={label}>
          {labels.kind}
          <select name="kind" defaultValue="HOMEWORK" className={field}>
            <option value="HOMEWORK">{labels.kindHomework}</option>
            <option value="QUIZ">{labels.kindQuiz}</option>
          </select>
        </label>
      )}

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

      <label className={label}>
        {labels.title}
        <input name="title" defaultValue={values.title ?? ""} required maxLength={200} dir="auto" className={field} />
      </label>

      <label className={label}>
        {labels.instructions}
        <textarea name="instructions" defaultValue={values.instructions ?? ""} maxLength={8000} rows={4} dir="auto" className={`${field} py-2`} />
      </label>

      <label className={label}>
        {labels.rubric}
        <textarea name="rubric" defaultValue={values.rubric ?? ""} maxLength={4000} rows={3} dir="auto" className={`${field} py-2`} />
      </label>

      <label className={label}>
        {labels.linkUrl}
        <input name="linkUrl" type="url" pattern="https://.*" defaultValue={values.linkUrl ?? ""} maxLength={500} dir="ltr" placeholder="https://" className={field} />
        {labels.linkHint && <span className="text-label font-normal text-ink-muted">{labels.linkHint}</span>}
      </label>

      <div className="flex flex-wrap items-end gap-4">
        <label className={label}>
          {labels.due}
          <input name="dueAt" type="datetime-local" defaultValue={values.dueAt ?? ""} className={field} />
        </label>
        <label className={label}>
          {labels.maxScore}
          <input name="maxScore" type="number" min={1} max={1000} defaultValue={values.maxScore ?? 100} required dir="ltr" className={`${field} num w-28`} />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-label text-ink-muted">
          <input type="checkbox" name="allowResubmit" defaultChecked={values.allowResubmit ?? false} className="size-4" />
          {labels.allowResubmit}
        </label>
      </div>

      <UploadField
        pathPrefix={`homework/${courseId}/`}
        clientPayload={JSON.stringify({ purpose: "assignment", courseId })}
        max={5}
        label={labels.files}
        failedLabel={labels.uploadFailed}
        removeLabel={labels.removeFile}
      />

      {state && <p role="alert" className="text-small text-down">{(labels as Record<string, string | undefined>)[state] ?? labels.invalid}</p>}

      <SubmitButton className="btn btn-primary w-fit">{labels.save}</SubmitButton>
    </form>
  );
}
