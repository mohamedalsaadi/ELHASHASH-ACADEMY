"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { linkChild } from "./actions";

const field = "min-h-11 rounded-sm border border-field bg-surface px-3 text-body text-ink";
const label = "grid gap-1 text-label text-ink-muted";

export function LinkChildForm() {
  const t = useTranslations("parent");
  const [state, action, pending] = useActionState(linkChild, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <label className={label}>
        {t("phone")}
        <input name="phone" type="tel" inputMode="numeric" dir="ltr" required autoComplete="tel" className={field} />
      </label>
      <label className={label}>
        {t("code")}
        <input name="code" inputMode="numeric" pattern="\d{6}" minLength={6} maxLength={6} dir="ltr" required className={`${field} num`} />
      </label>
      {state && (
        <p role="status" className={`basis-full text-small ${state === "ok" ? "text-up" : "text-down"}`}>
          {t(`errors.${state}`)}
        </p>
      )}
      <div className="basis-full">
        <button
          disabled={pending}
          className="btn btn-primary w-fit text-small"
        >
          {t("link")}
        </button>
      </div>
    </form>
  );
}
