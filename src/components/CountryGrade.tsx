"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { field, label } from "@/components/ui/form";
import { Req } from "@/components/ui/Req";

export type GradeGroup = { countryId: string; label: string; grades: { id: string; name: string }[] };

/**
 * A student's country is the country of the grade they pick, so the form asks for it first, with no default,
 * and lists only that country's grades. The server checks the pair again (gradeInCountry).
 */
export function CountryGrade({ groups, defaultGradeId, invalid, describedBy }: { groups: GradeGroup[]; defaultGradeId?: string; invalid?: boolean; describedBy?: string }) {
  const t = useTranslations("signup");
  const open = groups.filter((c) => c.grades.length > 0);
  const [countryId, setCountryId] = useState(open.find((c) => c.grades.some((g) => g.id === defaultGradeId))?.countryId ?? "");
  const grades = open.find((c) => c.countryId === countryId)?.grades ?? [];
  return (
    <>
      <label className={label}>
        <Req>{t("country")}</Req>
        <select name="countryId" required value={countryId} onChange={(e) => setCountryId(e.target.value)} aria-invalid={invalid && !countryId} aria-describedby={describedBy} className={field}>
          <option value="" disabled>
            {t("countryPick")}
          </option>
          {open.map((c) => (
            <option key={c.countryId} value={c.countryId}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        <Req>{t("grade")}</Req>
        <select
          key={countryId}
          name="gradeId"
          required
          disabled={!countryId}
          defaultValue={grades.some((g) => g.id === defaultGradeId) ? defaultGradeId : ""}
          aria-invalid={invalid && Boolean(countryId)}
          aria-describedby={describedBy}
          className={field}
        >
          <option value="" disabled>
            {t("gradePick")}
          </option>
          {grades.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
