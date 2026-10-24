import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/staff";
import { CreateCourseForm, PasswordForm, TeacherForm } from "./ui";

export const dynamic = "force-dynamic";

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("admin");
  const ar = locale === "ar";
  const tc = await getTranslations("catalog");
  const [courses, countries, subjects, teachers] = await Promise.all([
    db.course.findMany({ orderBy: { slug: "asc" }, include: { grade: true } }),
    db.country.findMany({ orderBy: { order: "asc" }, include: { grades: { orderBy: { level: "asc" } } } }),
    db.subject.findMany({ orderBy: { slug: "asc" } }),
    db.user.findMany({ where: { role: { in: ["INSTRUCTOR", "ADMIN"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const named = (rows: { id: string; nameAr: string; nameEn: string }[]) => rows.map((r) => ({ id: r.id, name: ar ? r.nameAr : r.nameEn }));
  const gradeGroups = countries.map((c) => ({ label: ar ? c.nameAr : c.nameEn, options: named(c.grades) }));

  return (
    <main className="mx-auto grid max-w-3xl gap-10 px-4 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-h1 font-semibold">{t("title")}</h1>
        <Link href="/admin/subjects" className="text-pen underline-offset-4 hover:underline">
          {t("subjectsLink")}
        </Link>
      </div>
      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-semibold">{t("courses")}</h2>
        <ul className="grid gap-2">
          {courses.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/courses/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-md border border-hairline bg-surface p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
              >
                <span className="grid gap-1">
                  <span className="font-display font-semibold">{ar ? c.titleAr : c.titleEn}</span>
                  <span className="text-small text-ink-muted">{c.grade ? (ar ? c.grade.nameAr : c.grade.nameEn) : tc("skill")}</span>
                </span>
                <span className={`text-label ${c.published ? "text-up" : "text-ink-muted"}`}>
                  {c.published ? t("published") : t("hidden")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-semibold">{t("createCourse")}</h2>
        <CreateCourseForm locale={locale} gradeGroups={gradeGroups} subjects={named(subjects)} teachers={teachers} />
      </section>
      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-semibold">{t("addTeacher")}</h2>
        <TeacherForm />
      </section>
      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-semibold">{t("changePassword")}</h2>
        <PasswordForm />
      </section>
    </main>
  );
}
