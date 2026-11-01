"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { CONTACT_EMAIL } from "@/lib/site";
import { sendSupportMessage } from "./actions";

const field = "min-h-11 rounded-sm border border-field bg-surface px-3 text-body text-ink";
const label = "grid gap-1 text-label text-ink-muted";

export function ContactForm() {
  const t = useTranslations("contactForm");
  const [state, action, pending] = useActionState(sendSupportMessage, null);
  return (
    <form action={action} className="grid gap-3 card bg-surface p-5">
      <h2 className="font-display text-h3 font-bold">{t("title")}</h2>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          {t("name")}
          <input name="name" required minLength={2} maxLength={80} autoComplete="name" className={field} />
        </label>
        <label className={label}>
          {t("email")}
          <input name="email" type="email" required dir="ltr" autoComplete="email" className={field} />
        </label>
        <label className={label}>
          {t("phone")}
          <input name="phone" type="tel" dir="ltr" autoComplete="tel" className={field} />
        </label>
        <label className={label}>
          {t("topic")}
          <select name="topic" className={field}>
            <option value="general">{t("topics.general")}</option>
            <option value="billing">{t("topics.billing")}</option>
            <option value="technical">{t("topics.technical")}</option>
            <option value="privacy">{t("topics.privacy")}</option>
          </select>
        </label>
      </div>
      <label className={label}>
        {t("message")}
        <textarea name="message" required minLength={20} maxLength={2000} rows={5} className={`${field} py-2`} />
      </label>
      {state === "ok" && (
        <p role="status" className="text-small text-up">
          {t("sent")}
        </p>
      )}
      {state === "invalid" && (
        <p role="alert" className="text-small text-down">
          {t("errors.invalid")}
        </p>
      )}
      {state === "limited" && (
        <p role="alert" className="text-small text-down">
          {t("errors.limited")}
        </p>
      )}
      {state === "unavailable" && (
        <p role="alert" className="text-small text-down">
          {t("errors.unavailable")}{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr" className="underline">
            {CONTACT_EMAIL}
          </a>
        </p>
      )}
      <button
        disabled={pending}
        className="btn btn-primary w-fit text-small"
      >
        {pending ? t("sending") : t("send")}
      </button>
    </form>
  );
}
