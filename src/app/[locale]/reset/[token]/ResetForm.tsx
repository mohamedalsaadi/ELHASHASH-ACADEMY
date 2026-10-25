"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { PasswordField } from "@/components/ui/PasswordField";
import { resetPassword } from "./actions";

export function ResetForm({ token }: { token: string }) {
  const t = useTranslations("reset");
  const [state, action, pending] = useActionState(resetPassword, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      <label className="grid gap-1 text-label text-ink-muted">
        {t("password")}
        <PasswordField
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          aria-invalid={Boolean(state)}
          aria-describedby="reset-error"
          className="min-h-11 rounded-sm border border-field bg-surface px-3 text-body text-ink"
        />
        <span className="text-label">{t("hint")}</span>
      </label>
      {state && (
        <p id="reset-error" role="alert" className="text-small text-down">
          {t(`errors.${state}`)}
        </p>
      )}
      <button
        disabled={pending}
        className="btn btn-primary w-fit text-small"
      >
        {t("submit")}
      </button>
    </form>
  );
}
