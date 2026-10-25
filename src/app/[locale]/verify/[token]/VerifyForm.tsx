"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { verifyEmail } from "./actions";

export function VerifyForm({ token }: { token: string }) {
  const t = useTranslations("verify");
  const [state, action, pending] = useActionState(verifyEmail, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      {state === "invalid" && (
        <p role="alert" className="text-small text-down">
          {t("invalid")}
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
