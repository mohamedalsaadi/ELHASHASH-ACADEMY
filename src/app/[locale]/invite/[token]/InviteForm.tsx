"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { PasswordField } from "@/components/ui/PasswordField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { field, label } from "../../admin/styles";
import { acceptInvite } from "./actions";

export function InviteForm({ token }: { token: string }) {
  const t = useTranslations("invite");
  const [state, action] = useActionState(acceptInvite, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      <label className={label}>
        {t("password")}
        <PasswordField name="password" required minLength={8} autoComplete="new-password" dir="ltr" className={field} />
      </label>
      <label className={label}>
        {t("confirm")}
        <PasswordField name="confirm" required minLength={8} autoComplete="new-password" dir="ltr" className={field} />
      </label>
      <p className="text-small text-ink-muted">{t("passwordHint")}</p>
      {state?.error && (
        <p role="alert" className="text-small text-down">
          {t(`errors.${state.error}`)}
        </p>
      )}
      <div>
        <SubmitButton pendingLabel={t("pending")} className="btn btn-primary w-fit text-small">
          {t("submit")}
        </SubmitButton>
      </div>
    </form>
  );
}
