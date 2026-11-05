"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { field, label } from "../../../../admin/styles";
import { SaveButton } from "../../../../admin/ui";
import { askQuestion } from "./actions";

export function AskForm({ lessonId }: { lessonId: string }) {
  const t = useTranslations("questions");
  const [state, action] = useActionState(askQuestion, null);
  return (
    <form key={state === "ok" ? Date.now() : "form"} action={action} className="grid gap-3">
      <input type="hidden" name="lessonId" value={lessonId} />
      <label className={label}>
        {t("ask")}
        <textarea name="body" dir="auto" required minLength={3} maxLength={1500} rows={4} className={`${field} py-2`} />
      </label>
      <p className="text-label text-ink-muted">{t("askHint")}</p>
      <p className="text-label text-ink-muted">{t("contactRule")}</p>
      {state && (
        <p role="status" className={`text-small ${state === "ok" ? "text-up" : state === "masked" ? "text-ink-muted" : "text-down"}`}>
          {t(`result.${state}`)}
        </p>
      )}
      <div>
        <SaveButton showSaved={false}>{t("send")}</SaveButton>
      </div>
    </form>
  );
}
