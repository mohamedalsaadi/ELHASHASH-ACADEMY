import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SubjectIcon, SUBJECT_ICONS } from "@/components/brand/SubjectIcon";
import { db } from "@/lib/db";
import { requireStaff, teacherCountryIds } from "@/lib/staff";
import { panel } from "../../admin/AdminNav";
import { field, label } from "../../admin/styles";
import { TeacherNav } from "../TeacherNav";
import { createSubject, requestCountry } from "./actions";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/teacher/subjects", "teacher", { key: "navSubjects", noindex: true });
}

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ c?: string; p?: string }> };

type CatalogGrade = {
  id: string;
  nameAr: string;
  nameEn: string;
  subjects: { subject: { id: string; nameAr: string; nameEn: string; icon: string } }[];
};

/** The country's grades with their subjects, read-only. */
function Catalog({ grades, ar }: { grades: CatalogGrade[]; ar: boolean }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {grades.map((g) => (
        <li key={g.id} className="grid gap-2 rounded-md border border-hairline p-3">
          <strong className="text-small">{ar ? g.nameAr : g.nameEn}</strong>
          <ul className="flex flex-wrap gap-2">
            {g.subjects.map(({ subject: s }) => (
              <li key={s.id} className="inline-flex items-center gap-1 rounded-full bg-raised px-3 py-1 text-small">
                <SubjectIcon icon={s.icon} size={16} />
                {ar ? s.nameAr : s.nameEn}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export default async function TeacherSubjectsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const me = await requireStaff();
  const t = await getTranslations("teacher");
  const ar = locale === "ar";
  const admin = me.role === "ADMIN";

  const gradeInclude = {
    where: { active: true },
    orderBy: [{ order: "asc" as const }, { level: "asc" as const }],
    include: { subjects: { orderBy: { order: "asc" as const }, where: { subject: { active: true } }, include: { subject: true } } },
  };
  const owned = admin ? null : await teacherCountryIds(me.id);
  const countries = await db.country.findMany({
    where: { active: true, ...(owned ? { id: { in: owned } } : {}) },
    orderBy: { order: "asc" },
    include: { grades: gradeInclude },
  });
  const current = countries.find((c) => c.id === sp.c) ?? countries[0];

  const others = admin ? [] : await db.country.findMany({ where: { active: true, id: { notIn: owned ?? [] } }, orderBy: { order: "asc" } });
  const preview = others.find((c) => c.id === sp.p);
  const previewGrades = preview
    ? await db.grade.findMany({ where: { countryId: preview.id, ...gradeInclude.where }, orderBy: gradeInclude.orderBy, include: gradeInclude.include })
    : [];
  const requests = admin
    ? []
    : await db.teacherCountryRequest.findMany({ where: { userId: me.id }, orderBy: { createdAt: "desc" }, include: { country: true }, take: 10 });
  const name = (c: { nameAr: string; nameEn: string }) => (ar ? c.nameAr : c.nameEn);

  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-4 py-12">
      <div className="grid gap-4">
        <h1 className="font-display text-h1 font-semibold">{t("subjectsTitle")}</h1>
        <TeacherNav current="subjects" />
        <p className="max-w-[65ch] text-small text-ink-muted">{t("subjectsHint")}</p>
      </div>

      {!current ? (
        <p className={panel}>{t("noCountry")}</p>
      ) : (
        <section className={panel}>
          <form className="flex flex-wrap items-end gap-3">
            <label className={label}>
              {t("country")}
              <select name="c" defaultValue={current.id} className={field}>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {name(c)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn-outline">
              {t("show")}
            </button>
          </form>

          <h2 className="font-display text-h3 font-semibold">{t("gradesIn", { country: name(current) })}</h2>
          <Catalog grades={current.grades} ar={ar} />

          <form action={createSubject} className="grid gap-3 border-t border-hairline pt-4">
            <h3 className="font-display text-h3 font-semibold">{t("newSubject")}</h3>
            <p className="text-small text-ink-muted">{t("newSubjectHint")}</p>
            <input type="hidden" name="countryId" value={current.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>
                {t("nameAr")}
                <input name="nameAr" required maxLength={80} dir="rtl" className={field} />
              </label>
              <label className={label}>
                {t("nameEn")}
                <input name="nameEn" required maxLength={80} dir="ltr" className={field} />
              </label>
            </div>
            <label className={label}>
              {t("icon")}
              <select name="icon" defaultValue="book" className={field}>
                {SUBJECT_ICONS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="grid gap-2">
              <legend className="text-small font-medium">{t("tickGrades")}</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {current.grades.map((g) => (
                  <label key={g.id} className="flex min-h-11 items-center gap-2 text-small">
                    <input type="checkbox" name="gradeId" value={g.id} className="size-4" />
                    {name(g)}
                  </label>
                ))}
              </div>
            </fieldset>
            <button type="submit" className="btn btn-primary w-fit">
              {t("addSubject")}
            </button>
          </form>
        </section>
      )}

      {!admin && (
        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("anotherCountry")}</h2>
          <p className="text-small text-ink-muted">{t("anotherCountryHint")}</p>
          {others.length === 0 ? (
            <p className="text-small text-ink-muted">{t("noOtherCountry")}</p>
          ) : (
            <form className="flex flex-wrap items-end gap-3">
              {current && <input type="hidden" name="c" value={current.id} />}
              <label className={label}>
                {t("country")}
                <select name="p" defaultValue={preview?.id ?? ""} className={field}>
                  <option value="" disabled>
                    —
                  </option>
                  {others.map((c) => (
                    <option key={c.id} value={c.id}>
                      {name(c)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="btn btn-outline">
                {t("show")}
              </button>
            </form>
          )}

          {preview && (
            <>
              <h3 className="font-display text-h3 font-semibold">{t("gradesIn", { country: name(preview) })}</h3>
              <Catalog grades={previewGrades} ar={ar} />
              {requests.some((r) => r.countryId === preview.id && r.status === "PENDING") ? (
                <p className="text-small text-ink-muted">{t("pending")}</p>
              ) : (
                <form action={requestCountry} className="grid gap-3">
                  <input type="hidden" name="countryId" value={preview.id} />
                  <label className={label}>
                    {t("requestNote")}
                    <textarea name="note" maxLength={500} rows={3} className={field} />
                  </label>
                  <button type="submit" className="btn btn-primary w-fit">
                    {t("requestAccess")}
                  </button>
                </form>
              )}
            </>
          )}

          {requests.length > 0 && (
            <ul className="grid gap-1 text-small">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap gap-2">
                  <strong>{name(r.country)}</strong>
                  <span className="text-ink-muted">{t(`req${r.status}`)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
