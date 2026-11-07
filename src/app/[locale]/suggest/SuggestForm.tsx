"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { field, label } from "@/components/ui/form";
import { Req } from "@/components/ui/Req";
import { SUGGESTION_KINDS } from "@/lib/suggestions-kinds";
import { sendSuggestion } from "./actions";

export function SuggestForm({ locale }: { locale: string }) {
  const t = useTranslations("suggest");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(sendSuggestion, null);
  if (state === "ok") {
    return (
      <p role="status" className="card p-5 text-up">
        {t("sent")}
      </p>
    );
  }
  return (
    <form action={action} className="grid gap-4 card bg-surface p-5">
      <input type="hidden" name="locale" value={locale} />
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <p className="text-label text-ink-muted">{tc("requiredNote")}</p>
      <label className={label}>
        <Req>{t("kind")}</Req>
        <select name="kind" required defaultValue="idea" className={field}>
          {SUGGESTION_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`kinds.${k}`)}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        <Req>{t("message")}</Req>
        <textarea name="message" required minLength={10} maxLength={1500} rows={6} dir="auto" className={`${field} py-2`} />
        <span className="text-label">{t("privacyNote")}</span>
      </label>
      {(state === "invalid" || state === "limited") && (
        <p role="alert" className="text-small text-down">
          {t(`errors.${state}`)}
        </p>
      )}
      <button disabled={pending} className="btn btn-primary w-fit text-small">
        {pending ? t("sending") : t("send")}
      </button>
    </form>
  );
}
