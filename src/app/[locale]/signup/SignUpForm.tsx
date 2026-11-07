"use client";

import { useTranslations } from "next-intl";
import { field, label } from "@/components/ui/form";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { PasswordField } from "@/components/ui/PasswordField";
import { PhoneField } from "@/components/ui/PhoneField";
import { Req } from "@/components/ui/Req";
import { Link } from "@/i18n/navigation";
import { ageOn, parseBirthDate } from "@/lib/age";
import { signUp } from "./actions";


function Submit({ disabled }: { disabled?: boolean }) {
  const t = useTranslations("signup");
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending || disabled}
      className="btn btn-primary"
    >
      {pending ? t("submitting") : t("submit")}
    </button>
  );
}

export function SignUpForm({ groups, locale, next, parent }: { groups: { label: string; grades: { id: string; name: string }[] }[]; locale: string; next: string; parent?: boolean }) {
  const t = useTranslations("signup");
  const tc = useTranslations("common");
  const [state, action] = useActionState(signUp, null);
  const v = state?.values;
  const [type, setType] = useState<"STUDENT" | "PARENT">((v ? v.type === "PARENT" : parent) ? "PARENT" : "STUDENT");
  // A guardian is asked for only when the birth date says the student is under 18.
  const [dob, setDob] = useState(v?.dateOfBirth ?? "");
  const born = parseBirthDate(dob);
  const minor = born !== null && ageOn(born) < 18;
  const hasGrades = groups.some((group) => group.grades.length > 0);
  return (
    // React resets the form after each submit; the key remounts it with what the student typed.
    <form key={JSON.stringify(state)} action={action} className="grid gap-4">
      <p className="text-label text-ink-muted">{tc("requiredNote")}</p>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      <label className={label}>
        {t("type")}
        <select name="type" value={type} onChange={(e) => setType(e.target.value as "STUDENT" | "PARENT")} className={field}>
          <option value="STUDENT">{t("typeStudent")}</option>
          <option value="PARENT">{t("typeParent")}</option>
        </select>
      </label>
      <label className={label}>
        <Req>{t("name")}</Req>
        <input
          name="name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={v?.name}
          dir="auto"
          aria-invalid={state?.error === "invalid_name"}
          aria-describedby="signup-error"
          className={field}
        />
      </label>
      <label className={label}>
        <Req>{t("email")}</Req>
        <input
          name="email"
          type="email"
          autoComplete="email"
          dir="ltr"
          required
          defaultValue={v?.email}
          aria-invalid={state?.error === "invalid_email"}
          aria-describedby="signup-error"
          className={field}
        />
        <span className="text-label">{t("emailHint")}</span>
      </label>
      <div className={label}>
        <Req>{t("phone")}</Req>
        <PhoneField defaultValue={v?.phone} invalid={state?.error === "invalid_phone"} describedBy="signup-error" />
        <span className="text-label">{t("phoneHint")}</span>
      </div>
      {type === "STUDENT" ? (
        <label className={label}>
          <Req>{t("grade")}</Req>
          <select name="gradeId" required defaultValue={v?.gradeId ?? ""} aria-invalid={state?.error === "invalid_grade"} aria-describedby="signup-error" className={field}>
            <option value="" disabled>
              {t("gradePick")}
            </option>
            {groups.map((c) => (
              <optgroup key={c.label} label={c.label}>
                {c.grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {!hasGrades && <span className="text-label text-down">{t("noGrades")}</span>}
        </label>
      ) : (
        <p className="text-small text-ink-muted">{t("parentHint")}</p>
      )}
      {type === "STUDENT" && (
        <>
          <label className={label}>
            <Req>{t("dateOfBirth")}</Req>
            <input
              type="date"
              name="dateOfBirth"
              required
              max={new Date().toISOString().slice(0, 10)}
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              dir="ltr"
              aria-invalid={state?.error === "invalid_birthdate" || state?.error === "too_young"}
              aria-describedby="signup-error"
              className={field}
            />
            <span className="text-label">{t("dateOfBirthHint")}</span>
          </label>
          {minor && (
            <>
          <label className={label}>
            {t("guardianName")}
            <input
              name="guardianName"
              autoComplete="name"
              minLength={2}
              maxLength={80}
              defaultValue={v?.guardianName}
              dir="auto"
              aria-invalid={state?.error === "guardian_required"}
              aria-describedby="signup-error"
              className={field}
            />
            <span className="text-label">{t("guardianHint")}</span>
          </label>
          <label className={label}>
            {t("guardianEmail")}
            <input
              type="email"
              name="guardianEmail"
              autoComplete="email"
              defaultValue={v?.guardianEmail}
              dir="ltr"
              aria-invalid={state?.error === "guardian_required"}
              aria-describedby="signup-error"
              className={field}
            />
            <span className="text-label">{t("guardianEmailHint")}</span>
          </label>
          <label className="flex min-h-11 items-center gap-3 text-small">
            <input
              type="checkbox"
              name="guardianConsent"
              defaultChecked={v?.guardianConsent ?? false}
              className="size-5 shrink-0"
              aria-invalid={state?.error === "guardian_required"}
              aria-describedby="signup-error"
            />
            <span>{t("guardianConsent")}</span>
          </label>
            </>
          )}
        </>
      )}
      <label className={label}>
        <Req>{t("password")}</Req>
        <PasswordField
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-invalid={state?.error === "password_too_short"}
          aria-describedby="signup-error"
          className={field}
        />
        <span className="text-label">{t("passwordHint")}</span>
      </label>
      {state?.error && (
        <p id="signup-error" role="alert" className="text-small text-down">
          {t(`errors.${state.error}`)}
        </p>
      )}
      <label className="flex min-h-11 items-center gap-3 text-small">
        <input
          type="checkbox"
          name="acceptTerms"
          required
          defaultChecked={v?.acceptTerms ?? false}
          className="size-5 shrink-0"
          aria-invalid={state?.error === "terms_required"}
          aria-describedby="signup-error"
        />
        <span>
          <span aria-hidden="true" className="text-down">* </span>
          {t.rich("acceptTerms", {
            terms: (chunks) => (
              <Link href="/terms" className="text-ink underline underline-offset-4">
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/privacy" className="text-ink underline underline-offset-4">
                {chunks}
              </Link>
            ),
          })}
        </span>
      </label>
      <Submit disabled={type === "STUDENT" && !hasGrades} />
    </form>
  );
}
