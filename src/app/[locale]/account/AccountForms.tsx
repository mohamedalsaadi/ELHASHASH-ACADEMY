"use client";

import { useTranslations } from "next-intl";
import { field, label } from "@/components/ui/form";
import { useActionState } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { PasswordField } from "@/components/ui/PasswordField";
import { changeOwnPassword, deleteAccount, generateParentCode, updateProfile } from "./actions";

const button =
  "btn btn-primary w-fit text-small";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState(updateProfile, null);
  return (
    <form action={action} className="grid gap-3">
      <label className={label}>
        {t("name")}
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={name}
          dir="auto"
          aria-invalid={state === "invalid_name"}
          aria-describedby="account-profile-error"
          className={field}
        />
      </label>
      <label className={label}>
        {t("email")}
        <input
          name="email"
          type="email"
          required
          dir="ltr"
          autoComplete="email"
          defaultValue={email}
          aria-invalid={state === "invalid_email" || state === "email_taken"}
          aria-describedby="account-profile-error"
          className={field}
        />
      </label>
      {state && (
        <p id="account-profile-error" role={state === "ok" ? "status" : "alert"} className={`text-small ${state === "ok" ? "text-up" : "text-down"}`}>
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
        <PasswordField
          name="current"
          autoComplete="current-password"
          required
          aria-invalid={state === "wrong"}
          aria-describedby="account-password-error"
          className={field}
        />
      </label>
      <label className={label}>
        {t("newPassword")}
        <PasswordField
          name="next"
          autoComplete="new-password"
          required
          minLength={8}
          aria-invalid={state === "short"}
          aria-describedby="account-password-error"
          className={field}
        />
      </label>
      {state && (
        <p id="account-password-error" role={state === "ok" ? "status" : "alert"} className={`text-small ${state === "ok" ? "text-up" : "text-down"}`}>
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
        <div className="flex flex-wrap items-center gap-3">
          <p className="num font-display text-h1 font-semibold tracking-[0.3em]" dir="ltr">
            {code}
          </p>
          <CopyButton value={code} />
        </div>
      )}
      <button disabled={pending} className={button}>
        {code ? t("newCode") : t("generateCode")}
      </button>
    </form>
  );
}

export function DeleteAccountForm() {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState(deleteAccount, null);
  return (
    <form id="delete-account" action={action} className="grid gap-3">
      <p className="text-small text-ink-muted">{t("dangerHint")}</p>
      <label className={label}>
        {t("passwordTitle")}
        <PasswordField name="password" autoComplete="current-password" required className={field} />
      </label>
      <label className="flex min-h-11 items-center gap-3 text-small">
        <input type="checkbox" name="confirm" required className="size-5 shrink-0" />
        <span>{t("dangerConfirm")}</span>
      </label>
      {state && state !== "ok" && (
        <p role="alert" className="text-small text-down">
          {t(`danger.${state}`)}
        </p>
      )}
      <button
        disabled={pending}
        className="inline-flex min-h-(--control-h) w-fit items-center rounded-full border border-down px-4 py-2 font-display text-small font-semibold text-down"
      >
        {t("dangerDelete")}
      </button>
    </form>
  );
}
