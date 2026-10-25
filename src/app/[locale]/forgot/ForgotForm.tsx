"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { requestReset } from "./actions";

export function ForgotForm() {
  const t = useTranslations("forgot");
  const [state, action, pending] = useActionState(requestReset, null);
  return (
    <form action={action} className="grid gap-3">
      <label className="grid gap-1 text-label text-ink-muted">
        {t("email")}
        <input
          name="email"
          type="email"
          required
          dir="ltr"
          autoComplete="email"
          className="min-h-11 rounded-sm border border-field bg-surface px-3 text-body text-ink"
        />
      </label>
      {state === "ok" && (
        <p role="status" className="text-small text-up">
          {t("sent")}
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
