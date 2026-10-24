"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { addTeacher, changePassword, createCourse } from "./actions";
import { field, label } from "./styles";

const button =
  "rounded-sm border border-ink-muted px-4 py-2 font-display font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised disabled:cursor-not-allowed disabled:opacity-45";

export function SaveButton({ children, danger }: { children?: React.ReactNode; danger?: boolean }) {
  const t = useTranslations("admin");
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={`${button} ${danger ? "border-down text-down" : ""}`}>
      {pending ? t("saving") : (children ?? t("save"))}
    </button>
  );
}

/** Submits the surrounding form to `action` only after the browser's confirm dialog. */
export function DeleteButton({ action, label, confirmText }: { action: (form: FormData) => Promise<void>; label?: string; confirmText?: string }) {
  const t = useTranslations("admin");
  return (
    <button
      formAction={action}
      onClick={(e) => {
        if (!confirm(confirmText ?? t("confirmDelete"))) e.preventDefault();
      }}
      className={`${button} border-down text-down`}
    >
      {label ?? t("delete")}
    </button>
  );
}

export function PasswordForm() {
  const t = useTranslations("admin");
  const [state, action] = useActionState(changePassword, null);
  return (
    <form action={action} className="grid max-w-sm gap-3">
      <label className={label}>
        {t("currentPassword")}
        <input name="current" type="password" autoComplete="current-password" required className={field} />
      </label>
      <label className={label}>
        {t("newPassword")}
        <input name="next" type="password" autoComplete="new-password" minLength={10} required className={field} />
      </label>
      {state && (
        <p role="status" className={`text-small ${state === "ok" ? "text-up" : "text-down"}`}>
          {t(`password.${state}`)}
        </p>
      )}
      <div>
        <SaveButton>{t("changePassword")}</SaveButton>
      </div>
    </form>
  );
}

export function TeacherForm() {
  const t = useTranslations("admin");
  const [state, action] = useActionState(addTeacher, null);
  return (
    <form key={state === "ok" ? Date.now() : "form"} action={action} className="grid max-w-sm gap-3">
      <label className={label}>
        {t("teacherName")}
        <input name="name" required minLength={2} maxLength={80} className={field} />
      </label>
      <label className={label}>
        {t("teacherLogin")}
        <input name="login" required dir="ltr" autoComplete="off" className={field} />
      </label>
      <label className={label}>
        {t("tempPassword")}
        <input name="password" required minLength={10} dir="ltr" autoComplete="new-password" className={field} />
      </label>
      <p className="text-small text-ink-muted">{t("teacherHint")}</p>
      {state && (
        <p role="status" className={`text-small ${state === "ok" ? "text-up" : "text-down"}`}>
          {t(`teacherResult.${state}`)}
        </p>
      )}
      <div>
        <SaveButton>{t("addTeacher")}</SaveButton>
      </div>
    </form>
  );
}

type Option = { id: string; name: string };
export type OptionGroup = { label: string; options: Option[] };

const optionList = (options: Option[]) =>
  options.map((o) => (
    <option key={o.id} value={o.id}>
      {o.name}
    </option>
  ));

/** Grades in one select, under a heading per country. */
export function GradeSelect({ groups, name = "gradeId", defaultValue }: { groups: OptionGroup[]; name?: string; defaultValue?: string }) {
  const t = useTranslations("admin");
  return (
    <label className={label}>
      {t("grade")}
      <select name={name} required defaultValue={defaultValue} className={field}>
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {optionList(g.options)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

export function CreateCourseForm({ locale, gradeGroups, subjects, teachers }: { locale: string; gradeGroups: OptionGroup[]; subjects: Option[]; teachers: Option[] }) {
  const t = useTranslations("admin");
  const [kind, setKind] = useState<"SCHOOL" | "SKILL">("SCHOOL");
  const select = (name: string, options: Option[]) => (
    <label className={label}>
      {t(name === "instructorId" ? "teacher" : "subject")}
      <select name={name} required className={field}>
        {optionList(options)}
      </select>
    </label>
  );
  return (
    <form action={createCourse} className="grid gap-3">
      <input type="hidden" name="locale" value={locale} />
      <label className={label}>
        {t("courseKind")}
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as "SCHOOL" | "SKILL")} className={field}>
          <option value="SCHOOL">{t("courseKinds.SCHOOL")}</option>
          <option value="SKILL">{t("courseKinds.SKILL")}</option>
        </select>
      </label>
      {kind === "SCHOOL" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <GradeSelect groups={gradeGroups} />
          {select("subjectId", subjects)}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>
            {t("titleAr")}
            <input name="titleAr" required maxLength={200} dir="rtl" className={field} />
          </label>
          <label className={label}>
            {t("titleEn")}
            <input name="titleEn" required maxLength={200} dir="ltr" className={field} />
          </label>
        </div>
      )}
      {select("instructorId", teachers)}
      {kind === "SCHOOL" && <p className="text-small text-ink-muted">{t("skillTitlesHint")}</p>}
      <div>
        <SaveButton>{t("createCourse")}</SaveButton>
      </div>
    </form>
  );
}
