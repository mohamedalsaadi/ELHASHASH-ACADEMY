"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { changeOwnPassword, generateParentCode, updateProfile } from "./actions";

const field = "min-h-11 rounded-sm border border-field bg-surface px-3 text-body text-ink";
const label = "grid gap-1 text-label text-ink-muted";
const button =
  "w-fit rounded-sm bg-primary px-[18px] py-3 font-display text-small font-semibold text-on-primary transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-[color-mix(in_oklab,var(--color-primary)_86%,#fff)] disabled:opacity-45";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState(updateProfile, null);
  return (
    <form action={action} className="grid gap-3">
      <label className={label}>
        {t("name")}
        <input name="name" required minLength={2} maxLength={80} defaultValue={name} className={field} />
      </label>
      <label className={label}>
        {t("email")}
        <input name="email" type="email" required dir="ltr" autoComplete="email" defaultValue={email} className={field} />
      </label>
      {state && (
        <p role="status" className={`text-small ${state === "ok" ? "text-up" : "text-down"}`}>
          {t(`profile.${state}`)}
        </p>
      )}
      <button disabled={pending} className={button}>
        {t("save")}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState(changeOwnPassword, null);
  return (
    <form action={action} className="grid gap-3">
      <label className={label}>
        {t("currentPassword")}
        <input name="current" type="password" autoComplete="current-password" required className={field} />
      </label>
      <label className={label}>
        {t("newPassword")}
        <input name="next" type="password" autoComplete="new-password" required minLength={8} className={field} />
      </label>
      {state && (
        <p role="status" className={`text-small ${state === "ok" ? "text-up" : "text-down"}`}>
          {t(`password.${state}`)}
        </p>
      )}
      <button disabled={pending} className={button}>
        {t("changePassword")}
      </button>
    </form>
  );
}

export function ParentCodeForm() {
  const t = useTranslations("account");
  const [code, action, pending] = useActionState(generateParentCode, null);
  return (
    <form action={action} className="grid gap-3">
      <p className="text-small text-ink-muted">{t("parentCodeHint")}</p>
      {code && (
        <p className="num font-display text-h1 font-semibold tracking-[0.3em]" dir="ltr">
          {code}
        </p>
      )}
      <button disabled={pending} className={button}>
        {code ? t("newCode") : t("generateCode")}
      </button>
    </form>
  );
}
