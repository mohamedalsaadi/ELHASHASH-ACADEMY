"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { DIAL_CODES, joinPhone, splitPhone } from "@/lib/phone";
import { field } from "./form";

/** A country-code list and the number beside it. The form gets one `phone` value: +<code><number>. */
export function PhoneField({ defaultValue = "", invalid, describedBy, name = "phone", required = true }: { defaultValue?: string; invalid?: boolean; describedBy?: string; name?: string; required?: boolean }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const start = splitPhone(defaultValue);
  const [dial, setDial] = useState(start.dial);
  const [national, setNational] = useState(start.national);
  const names = new Intl.DisplayNames(locale, { type: "region" });
  return (
    <div className="grid grid-cols-[auto_1fr] gap-2" dir="ltr">
      <select aria-label={t("dialCode")} value={dial} onChange={(e) => setDial(e.target.value)} className={`${field} max-w-44`}>
        {DIAL_CODES.map((c) => (
          <option key={c.dial} value={c.dial}>
            {names.of(c.region)} +{c.dial}
          </option>
        ))}
        <option value="">{t("dialOther")}</option>
      </select>
      <input
        type="tel"
        inputMode="tel"
        autoComplete={dial ? "tel-national" : "tel"}
        required={required}
        value={national}
        onChange={(e) => setNational(e.target.value)}
        placeholder={dial ? "" : "+…"}
        dir="ltr"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={`${field} min-w-0`}
      />
      <input type="hidden" name={name} value={joinPhone(dial, national)} />
    </div>
  );
}
