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
        className="btn btn-primary w-fit text-small"
      >
        {t("submit")}
      </button>
    </form>
  );
}
