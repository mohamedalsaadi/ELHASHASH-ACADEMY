"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signUp } from "./actions";

const field = "min-h-11 rounded-sm border border-field bg-surface px-3 text-body text-ink";
const label = "grid gap-2 text-label text-ink-muted";

function Submit() {
  const t = useTranslations("signup");
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-sm bg-primary px-[18px] py-3 font-display font-semibold text-on-primary transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-[color-mix(in_oklab,var(--color-primary)_86%,#fff)] disabled:cursor-not-allowed disabled:opacity-45"
    >
      {pending ? t("submitting") : t("submit")}
    </button>
  );
}

export function SignUpForm({ grades, locale, next }: { grades: { id: string; name: string }[]; locale: string; next: string }) {
  const t = useTranslations("signup");
  const [state, action] = useActionState(signUp, null);
  const v = state?.values;
  return (
    // React resets the form after each submit; the key remounts it with what the student typed.
    <form key={JSON.stringify(state)} action={action} className="grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      <label className={label}>
        {t("name")}
        <input name="name" autoComplete="name" required minLength={2} maxLength={80} defaultValue={v?.name} className={field} />
      </label>
      <label className={label}>
        {t("phone")}
        <input name="phone" type="tel" inputMode="numeric" autoComplete="tel" dir="ltr" required defaultValue={v?.phone} className={field} />
        <span className="text-label">{t("phoneHint")}</span>
      </label>
      <label className={label}>
        {t("grade")}
        <select name="gradeId" required defaultValue={v?.gradeId ?? ""} className={field}>
          <option value="" disabled>
            {t("gradePick")}
          </option>
          {grades.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        {t("password")}
        <input name="password" type="password" autoComplete="new-password" required minLength={8} className={field} />
        <span className="text-label">{t("passwordHint")}</span>
      </label>
      {state?.error && (
        <p role="alert" className="text-small text-down">
          {t(`errors.${state.error}`)}
        </p>
      )}
      <Submit />
    </form>
  );
}
