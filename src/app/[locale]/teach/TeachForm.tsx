"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { PasswordField } from "@/components/ui/PasswordField";
import { PhoneField } from "@/components/ui/PhoneField";
import { Req } from "@/components/ui/Req";
import { Link } from "@/i18n/navigation";
import { applyToTeach } from "./actions";

const field = "min-h-11 rounded-sm border border-field bg-surface px-3 text-body text-ink";
const label = "grid gap-2 text-label text-ink-muted";

function Submit() {
  const t = useTranslations("teach");
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="btn btn-primary">
      {pending ? t("submitting") : t("submit")}
    </button>
  );
}

export function TeachForm({ countries, locale }: { countries: { id: string; name: string }[]; locale: string }) {
  const t = useTranslations("teach");
  const tc = useTranslations("common");
  const [state, action] = useActionState(applyToTeach, null);

  if (state?.status === "sent") {
    return (
      <div role="status" className="grid gap-3 rounded-lg border border-hairline bg-surface p-4 shadow-paper">
        <p>{t("sent")}</p>
        <Link href="/" className="btn btn-outline w-fit">
          {t("goHome")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      <p className="text-label text-ink-muted">{tc("requiredNote")}</p>
      <label className={label}>
        <Req>{t("name")}</Req>
        <input name="name" autoComplete="name" required minLength={2} maxLength={80} dir="auto" className={field} />
      </label>
      <label className={label}>
        <Req>{t("email")}</Req>
        <input name="email" type="email" autoComplete="email" required dir="ltr" className={field} />
      </label>
      <div className={label}>
        <Req>{t("phone")}</Req>
        <PhoneField />
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-label text-ink-muted">{t("countries")}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {countries.map((c) => (
            <label key={c.id} className="flex min-h-11 items-center gap-2 text-small text-ink">
              <input type="checkbox" name="countryId" value={c.id} className="size-4" />
              {c.name}
            </label>
          ))}
        </div>
        <span className="text-label text-ink-muted">{t("countriesHint")}</span>
      </fieldset>
      <label className={label}>
        <Req>{t("subjects")}</Req>
        <input name="subjectsNote" required minLength={2} maxLength={500} dir="auto" className={field} />
      </label>
      <label className={label}>
        {t("bio")}
        <textarea name="bio" rows={3} maxLength={1000} dir="auto" className={`${field} py-2`} />
      </label>
      <label className={label}>
        <Req>{t("password")}</Req>
        <PasswordField name="password" autoComplete="new-password" required minLength={8} className={field} />
        <span className="text-label">{t("passwordHint")}</span>
      </label>
      {state && (
        <p role="alert" className="text-small text-down">
          {t(`errors.${state.status}`)}
        </p>
      )}
      <Submit />
    </form>
  );
}
