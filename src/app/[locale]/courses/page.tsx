import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { CourseCard, type CardCourse } from "@/components/CourseCard";
import { cardInclude } from "@/lib/catalog";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const ar = locale === "ar";

  const include = cardInclude(new Date());
  const [grades, skills] = await Promise.all([
    db.grade.findMany({
      where: { courses: { some: { published: true } } },
      orderBy: { level: "asc" },
      include: { courses: { where: { published: true }, orderBy: { titleEn: "asc" }, include } },
    }),
    db.course.findMany({ where: { kind: "SKILL", published: true }, orderBy: { titleEn: "asc" }, include }),
  ]);
  const cards = (courses: CardCourse[]) => (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((c) => (
        <li key={c.id}>
          <CourseCard course={c} locale={locale} />
        </li>
      ))}
    </ul>
  );
  const tab = "rounded-full border-[1.5px] border-ink px-4 py-2 font-display font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-marker";

  return (
    <main className="mx-auto grid max-w-5xl gap-12 px-4 py-12">
      <h1 className="font-display text-h1 font-extrabold">{t("title")}</h1>
      {grades.length + skills.length === 0 ? (
        <EmptyState>
          <p className="text-ink-muted">{t("empty")}</p>
        </EmptyState>
      ) : (
        <nav className="flex flex-wrap gap-3">
          <a href="#school" className={tab}>
            {t("schoolTab")}
          </a>
          <a href="#skills" className={tab}>
            {t("skillTab")}
          </a>
        </nav>
      )}
      {grades.length > 0 && (
        <div id="school" className="grid scroll-mt-24 gap-10">
          <h2 className="font-display text-h2 font-semibold">{t("schoolTab")}</h2>
          {grades.map((g) => (
            <section key={g.id} id={`g-${g.id}`} className="grid scroll-mt-24 gap-4">
              <h3 className="font-display text-h3 font-semibold text-ink-muted">{ar ? g.nameAr : g.nameEn}</h3>
              {cards(g.courses)}
            </section>
          ))}
        </div>
      )}
      {grades.length + skills.length > 0 && (
        <section id="skills" className="grid scroll-mt-24 gap-4">
          <h2 className="font-display text-h2 font-semibold">{t("skillTab")}</h2>
          {skills.length ? cards(skills) : <p className="text-ink-muted">{t("skillEmpty")}</p>}
        </section>
      )}
    </main>
  );
}
