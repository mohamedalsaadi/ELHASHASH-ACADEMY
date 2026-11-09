"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { field } from "@/components/ui/form";
import { askAssistant, type AssistantState } from "./actions";

/** Calm question box under the lesson. The answer comes only from this lesson's material; nothing is saved. */
export function AskLesson({ lessonId }: { lessonId: string }) {
  const t = useTranslations("assistant");
  const [state, action] = useActionState<AssistantState, FormData>(askAssistant, null);
  return (
    <section className="grid gap-3 card p-4" aria-labelledby="ask-lesson">
      <h2 id="ask-lesson" className="font-semibold">{t("title")}</h2>
      <form action={action} className="grid gap-2">
        <input type="hidden" name="lessonId" value={lessonId} />
        <textarea name="question" dir="auto" required minLength={3} maxLength={500} rows={2} aria-label={t("title")} placeholder={t("placeholder")} className={`${field} py-2`} />
        <p className="text-label text-ink-muted">{t("hint")}</p>
        <div>
          <SubmitButton showSaved={false} className="btn btn-outline px-4 py-2 text-small">{t("send")}</SubmitButton>
        </div>
      </form>
      <div aria-live="polite">
        {state?.error && <p className="text-small text-down">{t(`error.${state.error}`)}</p>}
        {state?.answer && (
          <div className="grid gap-1">
            <p className="whitespace-pre-wrap text-small" dir="auto">{state.answer}</p>
            {state.covered === false && <p className="text-label text-ink-muted">{t("notCovered")}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
