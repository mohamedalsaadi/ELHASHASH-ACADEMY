"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { changePassword } from "./actions";
import { field, label } from "./styles";

const button =
  "rounded-sm border border-ink-muted px-4 py-2 font-display font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised disabled:cursor-not-allowed disabled:opacity-45";

export function SaveButton({ children, danger }: { children?: React.ReactNode; danger?: boolean }) {
  const t = useTranslations("admin");
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={`${button} ${danger ? "border-down text-down" : ""}`}>
      {pending ? t("saving") : (children ?? t("save"))}
    </button>
  );
}

/** Submits the surrounding form to `action` only after the browser's confirm dialog. */
export function DeleteButton({ action }: { action: (form: FormData) => Promise<void> }) {
  const t = useTranslations("admin");
  return (
    <button
      formAction={action}
      onClick={(e) => {
        if (!confirm(t("confirmDelete"))) e.preventDefault();
      }}
      className={`${button} border-down text-down`}
    >
      {t("delete")}
    </button>
  );
}

export function PasswordForm() {
  const t = useTranslations("admin");
  const [state, action] = useActionState(changePassword, null);
  return (
    <form action={action} className="grid max-w-sm gap-3">
      <label className={label}>
        {t("currentPassword")}
        <input name="current" type="password" autoComplete="current-password" required className={field} />
      </label>
      <label className={label}>
        {t("newPassword")}
        <input name="next" type="password" autoComplete="new-password" minLength={10} required className={field} />
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
