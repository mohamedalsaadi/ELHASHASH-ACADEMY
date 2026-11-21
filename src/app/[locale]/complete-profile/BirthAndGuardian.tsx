"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { field } from "@/components/ui/form";
import { PhoneField } from "@/components/ui/PhoneField";
import { Req } from "@/components/ui/Req";
import { ageOn, MINOR_AGE, parseBirthDate } from "@/lib/age";

/** The birth date, and the guardian's details only when it says the student is under 13 (same rule as the sign-up form). */
export function BirthAndGuardian() {
  const t = useTranslations("signup");
  const [dob, setDob] = useState("");
  const born = parseBirthDate(dob);
  const minor = born !== null && ageOn(born) < MINOR_AGE;
  return (
    <>
      <label className="grid gap-2 text-label text-ink-muted">
        <Req>{t("dateOfBirth")}</Req>
        <input type="date" name="dateOfBirth" required max={new Date().toISOString().slice(0, 10)} value={dob} onChange={(e) => setDob(e.target.value)} dir="ltr" className={field} />
        <span className="text-label">{t("dateOfBirthHint")}</span>
      </label>
      {minor && (
        <>
          <label className="grid gap-2 text-label text-ink-muted">
            {t("guardianName")}
            <input name="guardianName" autoComplete="name" minLength={2} maxLength={80} dir="auto" className={field} />
            <span className="text-label">{t("guardianHint")}</span>
          </label>
          <div className="grid gap-2 text-label text-ink-muted">
            {t("guardianPhone")}
            <PhoneField name="guardianPhone" required={false} />
            <span className="text-label">{t("guardianPhoneHint")}</span>
          </div>
          <label className="grid gap-2 text-label text-ink-muted">
            {t("guardianEmail")}
            <input type="email" name="guardianEmail" autoComplete="email" dir="ltr" className={field} />
            <span className="text-label">{t("guardianEmailHint")}</span>
          </label>
          <label className="flex min-h-11 items-center gap-3 text-small">
            <input type="checkbox" name="guardianConsent" className="size-5 shrink-0" />
            <span>{t("guardianConsent")}</span>
          </label>
        </>
      )}
    </>
  );
}
