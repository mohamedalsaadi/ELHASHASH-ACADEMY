"use client";

import { useActionState } from "react";
import { field, label } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { saveTeacherCoupon, type CouponFormState } from "./actions";

export type CouponValues = { id?: string; code?: string; courseId?: string; percentOff?: number; startsAt?: string; endsAt?: string; maxRedemptions?: number | null; perUser?: number; active?: boolean };

type Labels = Record<"code" | "course" | "percent" | "start" | "end" | "max" | "perUser" | "active" | "save" | "invalid" | "cap" | "taken" | "saved", string>;

/** One discount code of a teacher: a course they teach, a percentage within their limit, and optional dates and use limits. */
export function CouponForm({ courses, cap, values = {}, labels }: { courses: { id: string; title: string }[]; cap: number; values?: CouponValues; labels: Labels }) {
  const [state, action] = useActionState(saveTeacherCoupon, null as CouponFormState);
  return (
    <form action={action} className="grid gap-3">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={label}>
          {labels.code}
          <input name="code" required defaultValue={values.code} maxLength={32} dir="ltr" className={`${field} uppercase`} />
        </label>
        <label className={label}>
          {labels.course}
          <select name="courseId" required defaultValue={values.courseId ?? courses[0]?.id} className={field}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          {labels.percent} (1 – {cap})
          <input name="percentOff" type="number" required min={1} max={cap} defaultValue={values.percentOff ?? ""} dir="ltr" className={`${field} num`} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className={label}>
          {labels.start}
          <input name="startsAt" type="date" defaultValue={values.startsAt ?? ""} className={field} />
        </label>
        <label className={label}>
          {labels.end}
          <input name="endsAt" type="date" defaultValue={values.endsAt ?? ""} className={field} />
        </label>
        <label className={label}>
          {labels.max}
          <input name="maxRedemptions" type="number" min={1} defaultValue={values.maxRedemptions ?? ""} dir="ltr" className={`${field} num`} />
        </label>
        <label className={label}>
          {labels.perUser}
          <input name="perUser" type="number" min={1} max={100} defaultValue={values.perUser ?? 1} dir="ltr" className={`${field} num`} />
        </label>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-small text-ink-muted">
        <input type="checkbox" name="active" defaultChecked={values.active ?? true} className="size-4" />
        {labels.active}
      </label>
      {state && state !== "ok" && <p role="alert" className="text-small text-down">{labels[state]}</p>}
      {state === "ok" && <p role="status" className="text-small text-up">{labels.saved}</p>}
      <SubmitButton className="btn btn-primary w-fit">{labels.save}</SubmitButton>
    </form>
  );
}
