"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import type { Currency } from "@/lib/pricing-engine";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { CopyButton } from "@/components/ui/CopyButton";
import { PasswordField } from "@/components/ui/PasswordField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { formatMoney, toMinor } from "@/lib/format";
import { planValue } from "@/lib/plans";
import { addTeacher, changePassword, createCourse, inviteTeacher, resetPassword } from "./actions";
import { field, label } from "./styles";

const button =
  "rounded-full border border-hairline bg-surface px-4 py-2 font-display font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised disabled:cursor-not-allowed disabled:opacity-45";

export function SaveButton({ children, danger }: { children?: React.ReactNode; danger?: boolean }) {
  const t = useTranslations("admin");
  return (
    <SubmitButton pendingLabel={t("saving")} className={`${button} ${danger ? "border-down text-down" : ""}`}>
      {children ?? t("save")}
    </SubmitButton>
  );
}

/** Submits the surrounding form to `action` only after an accessible confirmation dialog. */
export function DeleteButton({ action, label, confirmText }: { action: (form: FormData) => Promise<void>; label?: string; confirmText?: string }) {
  const t = useTranslations("admin");
  return (
    <ConfirmButton action={action} confirmText={confirmText ?? t("confirmDelete")} className={`${button} border-down text-down`}>
      {label ?? t("delete")}
    </ConfirmButton>
  );
}

export function PasswordForm() {
  const t = useTranslations("admin");
  const [state, action] = useActionState(changePassword, null);
  return (
    <form action={action} className="grid max-w-sm gap-3">
      <label className={label}>
        {t("currentPassword")}
        <PasswordField name="current" autoComplete="current-password" required className={field} />
      </label>
      <label className={label}>
        {t("newPassword")}
        <PasswordField name="next" autoComplete="new-password" minLength={10} required className={field} />
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

export type SlotOption = { value: string; label: string; group: string };

/** Invites a teacher to one or more (grade, subject) slots; the returned link is copyable. */
export function InviteTeacherForm({ locale, slots }: { locale: string; slots: SlotOption[] }) {
  const t = useTranslations("admin");
  const [state, action] = useActionState(inviteTeacher, null);
  const groups = [...new Set(slots.map((s) => s.group))];
  return (
    <form key={state && "ok" in state ? state.link : "form"} action={action} className="grid gap-3">
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          {t("teacherName")}
          <input name="name" required minLength={2} maxLength={80} className={field} />
        </label>
        <label className={label}>
          {t("inviteEmail")}
          <input name="email" type="email" dir="ltr" autoComplete="off" className={field} />
        </label>
        <label className={label}>
          {t("invitePhone")}
          <input name="phone" dir="ltr" inputMode="tel" autoComplete="off" className={field} />
        </label>
      </div>
      <p className="text-small text-ink-muted">{t("inviteContactHint")}</p>

      <fieldset className="grid gap-2 rounded-sm border border-rule p-3">
        <legend className="px-1 text-label text-ink-muted">{t("inviteSlots")}</legend>
        <div className="grid max-h-72 gap-3 overflow-y-auto sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g} className="grid gap-1">
              <p className="text-label font-semibold">{g}</p>
              {slots
                .filter((s) => s.group === g)
                .map((s) => (
                  <label key={s.value} className="flex items-center gap-2 text-small">
                    <input type="checkbox" name="slot" value={s.value} className="size-4" />
                    {s.label}
                  </label>
                ))}
            </div>
          ))}
        </div>
      </fieldset>

      {state &&
        ("ok" in state ? (
          <div className="grid gap-2">
            <p role="status" className="text-small text-up">{t("inviteCreated")}</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-sm border border-rule px-2 py-1 text-label" dir="ltr">
                {state.link}
              </code>
              <CopyButton value={state.link} />
            </div>
          </div>
        ) : (
          <p role="alert" className="text-small text-down">{t(`inviteErrors.${state.error}`)}</p>
        ))}

      <div>
        <SaveButton>{t("sendInvite")}</SaveButton>
      </div>
    </form>
  );
}

/** A plan's price input that shows, as the owner types, the price per lecture and how it compares with single lectures. */
export function PlanPrice({ label: text, defaultValue, currency, locale, lectures, single }: { label: string; defaultValue: number; currency: Currency; locale: string; lectures: number; single: number | null }) {
  const t = useTranslations("admin");
  // Kept as typed: a half-typed "9." is not a number yet.
  const [price, setPrice] = useState(String(defaultValue));
  const v = planValue(toMinor(Number(price) || 0, currency), lectures, single);
  return (
    <label className={label}>
      {text}
      <input name="price" type="number" min="0" step="0.001" value={price} onChange={(e) => setPrice(e.target.value)} required dir="ltr" className={`${field} num`} />
      {v && (
        <span className={`text-label ${v.savePct !== null && v.savePct < 0 ? "font-semibold text-down" : ""}`}>
          {t("perLecture", { count: lectures, price: formatMoney(v.perLecture, currency, locale) })}
          {v.savePct !== null && (v.savePct < 0 ? ` · ${t("dearerThanSingles")}` : ` · ${t("saveVsSingles", { pct: v.savePct })}`)}
        </span>
      )}
    </label>
  );
}

/** Sets a temporary password for a student or teacher. */
export function ResetPasswordForm({ userId }: { userId: string }) {
  const t = useTranslations("admin");
  const to = useTranslations("office");
  const [state, action] = useActionState(resetPassword, null);
  return (
    <form key={state === "ok" ? Date.now() : "form"} action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="userId" value={userId} />
      <label className={label}>
        {t("tempPassword")}
        <PasswordField name="password" required minLength={10} dir="ltr" autoComplete="new-password" className={field} />
      </label>
      <SaveButton>{to("resetPassword")}</SaveButton>
      {state && (
        <p role="status" className={`basis-full text-small ${state === "ok" ? "text-up" : "text-down"}`}>
          {to(`reset.${state}`)}
        </p>
      )}
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
