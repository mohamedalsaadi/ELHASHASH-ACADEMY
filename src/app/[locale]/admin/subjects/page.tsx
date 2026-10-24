import { getTranslations, setRequestLocale } from "next-intl/server";
import { SubjectIcon } from "@/components/brand/SubjectIcon";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/staff";
import { setGradeSubjects } from "../actions";
import { GradeSelect, SaveButton } from "../ui";

export const dynamic = "force-dynamic";

const button =
  "rounded-sm border border-ink-muted px-4 py-2 font-display font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised";

export default async function GradeSubjectsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ grade?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("admin");
  const ar = locale === "ar";

  const [countries, subjects] = await Promise.all([
    db.country.findMany({ orderBy: { order: "asc" }, include: { grades: { orderBy: { level: "asc" } } } }),
    db.subject.findMany({ orderBy: { slug: "asc" } }),
  ]);
  const gradeId = (await searchParams).grade ?? countries[0]?.grades[0]?.id;
  const ticked = gradeId ? await db.gradeSubject.findMany({ where: { gradeId }, orderBy: { order: "asc" }, select: { subjectId: true } }) : [];
  const on = new Set(ticked.map((g) => g.subjectId));
  // Ticked subjects keep their order on the grade page; the rest follow.
  const ordered = [...ticked.map((g) => subjects.find((s) => s.id === g.subjectId)!), ...subjects.filter((s) => !on.has(s.id))];
  const groups = countries.map((c) => ({ label: ar ? c.nameAr : c.nameEn, options: c.grades.map((g) => ({ id: g.id, name: ar ? g.nameAr : g.nameEn })) }));

  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-4 py-12">
      <div className="grid gap-2">
        <h1 className="font-display text-h1 font-semibold">{t("subjectsTitle")}</h1>
        <p className="max-w-[60ch] text-small text-ink-muted">{t("subjectsHint")}</p>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <GradeSelect groups={groups} name="grade" defaultValue={gradeId} />
        <button className={button}>{t("subjectsOpen")}</button>
      </form>

      {gradeId && (
        <form key={gradeId} action={setGradeSubjects} className="grid gap-4">
          <input type="hidden" name="gradeId" value={gradeId} />
          <ul className="grid gap-2 sm:grid-cols-2">
            {ordered.map((s) => (
              <li key={s.id}>
                <label className="flex items-center gap-3 rounded-md border border-hairline bg-surface p-3 has-checked:border-ink">
                  <input type="checkbox" name="subject" value={s.id} defaultChecked={on.has(s.id)} className="size-5 accent-(--color-pen)" />
                  <SubjectIcon icon={s.icon} size={28} muted={!on.has(s.id)} />
                  <span className="font-display font-semibold">{ar ? s.nameAr : s.nameEn}</span>
                </label>
              </li>
            ))}
          </ul>
          <div>
            <SaveButton />
          </div>
        </form>
      )}
    </main>
  );
}
