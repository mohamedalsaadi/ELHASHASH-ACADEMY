"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { resetPassword } from "./actions";

export function ResetForm({ token }: { token: string }) {
  const t = useTranslations("reset");
  const [state, action, pending] = useActionState(resetPassword, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      <label className="grid gap-1 text-label text-ink-muted">
        {t("password")}
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="min-h-11 rounded-sm border border-field bg-surface px-3 text-body text-ink"
        />
        <span className="text-label">{t("hint")}</span>
      </label>
      {state && (
        <p role="alert" className="text-small text-down">
          {t(`errors.${state}`)}
        </p>
      )}
      <button
        disabled={pending}
        className="w-fit rounded-sm bg-primary px-[18px] py-3 font-display text-small font-semibold text-on-primary transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-[color-mix(in_oklab,var(--color-primary)_86%,#fff)] disabled:opacity-45"
      >
        {t("submit")}
      </button>
    </form>
  );
}
