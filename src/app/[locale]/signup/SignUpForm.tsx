"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { PasswordField } from "@/components/ui/PasswordField";
import { Link } from "@/i18n/navigation";
import { signUp } from "./actions";

const field = "min-h-11 rounded-sm border border-field bg-surface px-3 text-body text-ink";
const label = "grid gap-2 text-label text-ink-muted";

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
  const [state, action] = useActionState(signUp, null);
  const v = state?.values;
  const [type, setType] = useState<"STUDENT" | "PARENT">((v ? v.type === "PARENT" : parent) ? "PARENT" : "STUDENT");
  const hasGrades = groups.some((group) => group.grades.length > 0);
  return (
    // React resets the form after each submit; the key remounts it with what the student typed.
    <form key={JSON.stringify(state)} action={action} className="grid gap-4">
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
        {t("name")}
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
        {t("email")}
        <input
          name="email"
          type="email"
          autoComplete="email"
          dir="ltr"
          required
          defaultValue={v?.email}
          aria-invalid={state?.error === "invalid_email" || state?.error === "email_taken"}
          aria-describedby="signup-error"
          className={field}
        />
        <span className="text-label">{t("emailHint")}</span>
      </label>
      <label className={label}>
        {t("phone")}
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          required
          defaultValue={v?.phone}
          aria-invalid={state?.error === "invalid_phone" || state?.error === "phone_taken"}
          aria-describedby="signup-error"
          className={field}
        />
        <span className="text-label">{t("phoneHint")}</span>
      </label>
      {type === "STUDENT" ? (
        <label className={label}>
          {t("grade")}
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
      <label className={label}>
        {t("password")}
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
      <p className="text-small text-ink-muted">
        {t.rich("terms", {
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
      </p>
      <Submit disabled={type === "STUDENT" && !hasGrades} />
    </form>
  );
}
