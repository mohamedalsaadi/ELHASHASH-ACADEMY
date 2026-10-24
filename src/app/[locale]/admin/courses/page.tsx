import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/staff";
import { AdminNav } from "../AdminNav";
import { field, label } from "../styles";
import { CreateCourseForm } from "../ui";

export const dynamic = "force-dynamic";

const button = "min-h-11 rounded-sm border border-ink-muted px-4 font-display font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised";

export default async function AdminCoursesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ country?: string; grade?: string }> }) {
  const { locale } = await params;
  const f = await searchParams;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("admin");
  const to = await getTranslations("office");
  const tc = await getTranslations("catalog");
  const ar = locale === "ar";

  const [countries, subjects, teachers] = await Promise.all([
    db.country.findMany({ orderBy: { order: "asc" }, include: { grades: { orderBy: { level: "asc" } } } }),
    db.subject.findMany({ orderBy: { slug: "asc" } }),
    db.user.findMany({ where: { role: { in: ["INSTRUCTOR", "ADMIN"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  // A grade wins over its country; "skill" lists the courses outside school.
  const where = f.grade
    ? { gradeId: f.grade }
    : f.country === "skill"
      ? { kind: "SKILL" as const }
      : f.country
        ? { grade: { country: { code: f.country as never } } }
        : {};
  const courses = await db.course.findMany({ where, orderBy: { slug: "asc" }, include: { grade: { include: { country: true } }, instructor: { select: { name: true } } } });
  const named = (rows: { id: string; nameAr: string; nameEn: string }[]) => rows.map((r) => ({ id: r.id, name: ar ? r.nameAr : r.nameEn }));
  const gradeGroups = countries.map((c) => ({ label: ar ? c.nameAr : c.nameEn, options: named(c.grades) }));
  const shownGrades = countries.filter((c) => !f.country || c.code === f.country).flatMap((c) => c.grades);

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-12">
      <AdminNav current="courses" />

      <form className="flex flex-wrap items-end gap-3">
        <label className={label}>
          {to("country")}
          <select name="country" defaultValue={f.country ?? ""} className={field}>
            <option value="">{to("all")}</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {ar ? c.nameAr : c.nameEn}
              </option>
            ))}
            <option value="skill">{tc("skill")}</option>
          </select>
        </label>
        <label className={label}>
          {to("grade")}
          <select name="grade" defaultValue={f.grade ?? ""} className={field}>
            <option value="">{to("all")}</option>
            {shownGrades.map((g) => (
              <option key={g.id} value={g.id}>
                {ar ? g.nameAr : g.nameEn}
              </option>
            ))}
          </select>
        </label>
        <button className={button}>{to("filter")}</button>
      </form>

      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-semibold">{to("courseCount", { count: courses.length })}</h2>
        <ul className="grid gap-2">
          {courses.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/courses/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-md border border-hairline bg-surface p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
              >
                <span className="grid gap-1">
                  <span className="font-display font-semibold">{ar ? c.titleAr : c.titleEn}</span>
                  <span className="text-small text-ink-muted">
                    {c.grade ? `${ar ? c.grade.country.nameAr : c.grade.country.nameEn} · ${ar ? c.grade.nameAr : c.grade.nameEn}` : tc("skill")} · {c.instructor.name}
                  </span>
                </span>
                <span className={`text-label ${c.published ? "text-up" : "text-ink-muted"}`}>{c.published ? t("published") : t("hidden")}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-semibold">{t("createCourse")}</h2>
        <CreateCourseForm locale={locale} gradeGroups={gradeGroups} subjects={named(subjects)} teachers={teachers} />
      </section>
    </main>
  );
}
