import { pick } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { SubjectIcon, SUBJECT_ICONS } from "@/components/brand/SubjectIcon";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/staff";
import {
  deleteCountry,
  deleteGrade,
  deleteStage,
  deleteSubject,
  saveCountry,
  saveGrade,
  saveStage,
  saveSubject,
  setGradeSubjects,
} from "../actions";
import { AdminNav, panel } from "../AdminNav";
import { field, label } from "../styles";
import { DeleteButton, GradeSelect, SaveButton } from "../ui";

export const dynamic = "force-dynamic";

const check = "flex min-h-11 items-center gap-2 text-small text-ink-muted";
const smallButton =
  "rounded-full border border-hairline bg-surface px-4 py-2 font-display text-small font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised";
const CURRENCIES = ["EGP", "SAR", "AED", "KWD", "QAR", "BHD", "OMR"] as const;
const CURRICULA = ["NATIONAL_EG", "MOE", "BRITISH", "AMERICAN", "IB"] as const;

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin/catalog", "office", { key: "nav.catalog", noindex: true });
}

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ country?: string; grade?: string; error?: string }>;
}) {
  const { locale } = await params;
  const f = await searchParams;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("admin");
  const ar = locale === "ar";

  const [countries, subjects] = await Promise.all([
    db.country.findMany({
      orderBy: { order: "asc" },
      include: {
        _count: { select: { grades: true } },
        stages: { orderBy: { order: "asc" } },
        grades: {
          orderBy: [{ order: "asc" }, { level: "asc" }],
          include: { _count: { select: { courses: true, users: true } } },
        },
      },
    }),
    db.subject.findMany({ orderBy: { slug: "asc" }, include: { _count: { select: { courses: true, grades: true } } } }),
  ]);

  const country = countries.find((c) => c.id === f.country) ?? countries[0];
  const gradeId = f.grade ?? country?.grades[0]?.id;
  const ticked = gradeId ? await db.gradeSubject.findMany({ where: { gradeId }, orderBy: { order: "asc" }, select: { subjectId: true } }) : [];
  const on = new Set(ticked.map((g) => g.subjectId));
  const ordered = [
    ...ticked.map((g) => subjects.find((s) => s.id === g.subjectId)).filter((s): s is (typeof subjects)[number] => Boolean(s)),
    ...subjects.filter((s) => !on.has(s.id)),
  ];
  const gradeGroups = countries.map((c) => ({
    label: pick(ar, c.nameAr, c.nameEn),
    options: c.grades.map((g) => ({ id: g.id, name: pick(ar, g.nameAr, g.nameEn) })),
  }));

  type CountryRow = (typeof countries)[number];
  type StageRow = CountryRow["stages"][number];
  type GradeRow = CountryRow["grades"][number];
  type SubjectRow = (typeof subjects)[number];

  const countryFields = (c?: CountryRow) => (
    <>
      <label className={label}>
        {t("code")}
        <input name="code" defaultValue={c?.code ?? ""} readOnly={Boolean(c)} required pattern="[A-Za-z]{2}" maxLength={2} dir="ltr" className={field} />
      </label>
      <label className={label}>
        {t("titleAr")}
        <input name="nameAr" defaultValue={c?.nameAr ?? ""} required maxLength={80} dir="rtl" className={field} />
      </label>
      <label className={label}>
        {t("titleEn")}
        <input name="nameEn" defaultValue={c?.nameEn ?? ""} required maxLength={80} dir="ltr" className={field} />
      </label>
      <label className={label}>
        {t("currency")}
        <select name="currency" defaultValue={c?.currency ?? "AED"} className={field}>
          {CURRENCIES.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        {t("timeZone")}
        <input name="timeZone" defaultValue={c?.timeZone ?? "Asia/Dubai"} required dir="ltr" className={field} />
      </label>
      <label className={label}>
        {t("order")}
        <input name="order" type="number" min="0" max="999" step="1" defaultValue={c?.order ?? 0} dir="ltr" className={`${field} num`} />
      </label>
      <label className={check}>
        <input type="checkbox" name="active" defaultChecked={c?.active ?? true} className="size-4" />
        {t("active")}
      </label>
      <label className={check}>
        <input type="checkbox" name="vatEnabled" defaultChecked={c?.vatEnabled ?? false} className="size-4" />
        {t("vatEnabled")}
      </label>
      <label className={label}>
        {t("vatRate")}
        <input
          name="vatRate"
          type="number"
          min="0"
          max="50"
          step="0.01"
          defaultValue={(c?.vatRateBp ?? 500) / 100}
          dir="ltr"
          className={`${field} num`}
        />
      </label>
      <label className={label}>
        {t("vatTrn")}
        <input name="vatTrn" defaultValue={c?.vatTrn ?? ""} maxLength={40} dir="ltr" className={field} />
      </label>
      <p className="text-small text-ink-muted sm:col-span-2">{t("vatHint")}</p>
    </>
  );

  const stageFields = (s?: StageRow) => (
    <>
      <label className={label}>
        {t("titleAr")}
        <input name="nameAr" defaultValue={s?.nameAr ?? ""} required maxLength={80} dir="rtl" className={field} />
      </label>
      <label className={label}>
        {t("titleEn")}
        <input name="nameEn" defaultValue={s?.nameEn ?? ""} required maxLength={80} dir="ltr" className={field} />
      </label>
      <label className={label}>
        {t("fromLevel")}
        <input name="fromLevel" type="number" min="1" max="12" step="1" defaultValue={s?.fromLevel ?? 1} required dir="ltr" className={`${field} num`} />
      </label>
      <label className={label}>
        {t("toLevel")}
        <input name="toLevel" type="number" min="1" max="12" step="1" defaultValue={s?.toLevel ?? 12} required dir="ltr" className={`${field} num`} />
      </label>
      <label className={label}>
        {t("order")}
        <input name="order" type="number" min="0" max="999" step="1" defaultValue={s?.order ?? 0} dir="ltr" className={`${field} num`} />
      </label>
    </>
  );

  const gradeFields = (g?: GradeRow) => (
    <>
      <label className={label}>
        {t("curriculum")}
        <select name="curriculum" defaultValue={g?.curriculum ?? "MOE"} className={field}>
          {CURRICULA.map((x) => (
            <option key={x} value={x}>
              {t(`curricula.${x}`)}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        {t("level")}
        <input name="level" type="number" min="1" max="12" step="1" defaultValue={g?.level ?? 1} required dir="ltr" className={`${field} num`} />
      </label>
      <label className={label}>
        {t("track")}
        <select name="track" defaultValue={g?.track ?? "GENERAL"} className={field}>
          {(["GENERAL", "ADVANCED"] as const).map((x) => (
            <option key={x} value={x}>
              {t(`tracks.${x}`)}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        {t("titleAr")}
        <input name="nameAr" defaultValue={g?.nameAr ?? ""} required maxLength={80} dir="rtl" className={field} />
      </label>
      <label className={label}>
        {t("titleEn")}
        <input name="nameEn" defaultValue={g?.nameEn ?? ""} required maxLength={80} dir="ltr" className={field} />
      </label>
      <label className={label}>
        {t("order")}
        <input name="order" type="number" min="0" max="999" step="1" defaultValue={g?.order ?? 0} dir="ltr" className={`${field} num`} />
      </label>
      <label className={check}>
        <input type="checkbox" name="isTerminal" defaultChecked={g?.isTerminal ?? false} className="size-4" />
        {t("terminal")}
      </label>
      <label className={check}>
        <input type="checkbox" name="active" defaultChecked={g?.active ?? true} className="size-4" />
        {t("active")}
      </label>
    </>
  );

  const subjectFields = (s?: SubjectRow) => (
    <>
      <label className={label}>
        {t("subjectSlug")}
        <input name="slug" defaultValue={s?.slug ?? ""} required maxLength={40} dir="ltr" className={field} />
      </label>
      <label className={label}>
        {t("titleAr")}
        <input name="nameAr" defaultValue={s?.nameAr ?? ""} required maxLength={80} dir="rtl" className={field} />
      </label>
      <label className={label}>
        {t("titleEn")}
        <input name="nameEn" defaultValue={s?.nameEn ?? ""} required maxLength={80} dir="ltr" className={field} />
      </label>
      <label className={label}>
        {t("subjectIcon")}
        <select name="icon" defaultValue={s?.icon ?? "book"} className={field}>
          {SUBJECT_ICONS.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </label>
      <label className={check}>
        <input type="checkbox" name="active" defaultChecked={s?.active ?? true} className="size-4" />
        {t("active")}
      </label>
    </>
  );

  return (
    <main className="mx-auto grid max-w-5xl gap-10 px-4 py-12">
      <AdminNav current="catalog" title={t("catalogTitle")} />
      {f.error && (
        <p role="alert" className="rounded-sm border border-down px-3 py-2 text-small text-down">
          {t(`catalogErrors.${f.error}`)}
        </p>
      )}

      <section className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="font-display text-h2 font-semibold">{t("countriesTitle")}</h2>
          <p className="text-small text-ink-muted">{t("countriesHint")}</p>
        </div>
        {countries.map((c) => (
          <form key={c.id} action={saveCountry} className={panel}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={c.id} />
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-display font-semibold">
                {c.code} · {pick(ar, c.nameAr, c.nameEn)}
              </span>
              <span className="text-label text-ink-muted">{t("countryGradeCount", { count: c._count.grades })}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">{countryFields(c)}</div>
            <div className="flex flex-wrap gap-3">
              <SaveButton />
              <DeleteButton action={deleteCountry} confirmText={t("confirmDeleteCountry")} />
            </div>
          </form>
        ))}
        {countries.length === 0 && (
          <EmptyState>
            <p className="text-ink-muted">{t("noCatalogCountries")}</p>
          </EmptyState>
        )}
        <form action={saveCountry} className={panel}>
          <input type="hidden" name="locale" value={locale} />
          <h3 className="font-display text-h3 font-semibold">{t("addCountry")}</h3>
          <div className="grid gap-3 sm:grid-cols-4">{countryFields()}</div>
          <div>
            <SaveButton>{t("addCountry")}</SaveButton>
          </div>
        </form>
      </section>

      <section className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="font-display text-h2 font-semibold">{t("stagesTitle")}</h2>
          <p className="text-small text-ink-muted">{t("stagesHint")}</p>
        </div>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className={label}>
            {t("chooseCountry")}
            <select name="country" defaultValue={country?.id ?? ""} className={field}>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {pick(ar, c.nameAr, c.nameEn)}
                </option>
              ))}
            </select>
          </label>
          <button className={smallButton}>{t("show")}</button>
        </form>
        {country &&
          country.stages.map((s) => (
            <form key={s.id} action={saveStage} className={panel}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="countryId" value={country.id} />
              <div className="grid gap-3 sm:grid-cols-5">{stageFields(s)}</div>
              <div className="flex flex-wrap gap-3">
                <SaveButton />
                <DeleteButton action={deleteStage} confirmText={t("confirmDeleteStage")} />
              </div>
            </form>
          ))}
        {country && country.stages.length === 0 && (
          <EmptyState>
            <p className="text-ink-muted">{t("noStages")}</p>
          </EmptyState>
        )}
        {country && (
          <form action={saveStage} className={panel}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="countryId" value={country.id} />
            <h3 className="font-display text-h3 font-semibold">{t("addStage")}</h3>
            <div className="grid gap-3 sm:grid-cols-5">{stageFields()}</div>
            <div>
              <SaveButton>{t("addStage")}</SaveButton>
            </div>
          </form>
        )}
      </section>

      <section className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="font-display text-h2 font-semibold">{t("gradesTitle")}</h2>
          <p className="text-small text-ink-muted">{t("gradesHint")}</p>
        </div>
        {country &&
          country.grades.map((g) => (
            <form key={g.id} action={saveGrade} className={panel}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={g.id} />
              <input type="hidden" name="countryId" value={country.id} />
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-display font-semibold">
                  {pick(ar, g.nameAr, g.nameEn)} · {t(`curricula.${g.curriculum}`)}
                </span>
                <span className="text-label text-ink-muted">{t("gradeUsage", { courses: g._count.courses, users: g._count.users })}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-5">{gradeFields(g)}</div>
              <div className="flex flex-wrap items-center gap-3">
                <SaveButton />
                {g._count.courses === 0 && g._count.users === 0 ? (
                  <DeleteButton action={deleteGrade} confirmText={t("confirmDeleteGrade")} />
                ) : (
                  <span className="text-small text-ink-muted">{t("inUse")}</span>
                )}
              </div>
            </form>
          ))}
        {country && country.grades.length === 0 && (
          <EmptyState>
            <p className="text-ink-muted">{t("noCatalogGrades")}</p>
          </EmptyState>
        )}
        {country && (
          <form action={saveGrade} className={panel}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="countryId" value={country.id} />
            <h3 className="font-display text-h3 font-semibold">{t("addGrade")}</h3>
            <div className="grid gap-3 sm:grid-cols-5">{gradeFields()}</div>
            <div>
              <SaveButton>{t("addGrade")}</SaveButton>
            </div>
          </form>
        )}
      </section>

      <section className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="font-display text-h2 font-semibold">{t("subjectsListTitle")}</h2>
          <p className="text-small text-ink-muted">{t("subjectsListHint")}</p>
        </div>
        {subjects.map((s) => (
          <form key={s.id} action={saveSubject} className={panel}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={s.id} />
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="flex items-center gap-2 font-display font-semibold">
                <SubjectIcon icon={s.icon} size={24} muted={!s.active} />
                {pick(ar, s.nameAr, s.nameEn)}
              </span>
              <span className="text-label text-ink-muted">{t("subjectUsage", { courses: s._count.courses, grades: s._count.grades })}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-5">{subjectFields(s)}</div>
            <div className="flex flex-wrap items-center gap-3">
              <SaveButton />
              {s._count.courses === 0 && s._count.grades === 0 ? (
                <DeleteButton action={deleteSubject} confirmText={t("confirmDeleteSubject")} />
              ) : (
                <span className="text-small text-ink-muted">{t("inUse")}</span>
              )}
            </div>
          </form>
        ))}
        {subjects.length === 0 && (
          <EmptyState>
            <p className="text-ink-muted">{t("noCatalogSubjects")}</p>
          </EmptyState>
        )}
        <form action={saveSubject} className={panel}>
          <input type="hidden" name="locale" value={locale} />
          <h3 className="font-display text-h3 font-semibold">{t("addSubject")}</h3>
          <div className="grid gap-3 sm:grid-cols-5">{subjectFields()}</div>
          <div>
            <SaveButton>{t("addSubject")}</SaveButton>
          </div>
        </form>
      </section>

      <section className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="font-display text-h2 font-semibold">{t("subjectsTitle")}</h2>
          <p className="text-small text-ink-muted">{t("subjectsHint")}</p>
        </div>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <GradeSelect groups={gradeGroups} name="grade" defaultValue={gradeId} />
          <button className={smallButton}>{t("subjectsOpen")}</button>
        </form>
        {gradeId && (
          <form key={gradeId} action={setGradeSubjects} className="grid gap-4">
            <input type="hidden" name="gradeId" value={gradeId} />
            <ul className="grid gap-2 sm:grid-cols-2">
              {ordered.map((s) => (
                <li key={s.id}>
                  <label className="flex items-center gap-3 rounded-lg border border-hairline bg-surface shadow-paper p-3 has-checked:border-primary has-checked:ring-2 has-checked:ring-primary/20">
                    <input type="checkbox" name="subject" value={s.id} defaultChecked={on.has(s.id)} className="size-5 accent-(--color-pen)" />
                    <SubjectIcon icon={s.icon} size={28} muted={!s.active} />
                    <span className={`font-display font-semibold ${s.active ? "" : "text-ink-muted"}`}>{pick(ar, s.nameAr, s.nameEn)}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div>
              <SaveButton />
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
