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
        className="btn btn-primary w-fit text-small"
      >
        {t("submit")}
      </button>
    </form>
  );
}
