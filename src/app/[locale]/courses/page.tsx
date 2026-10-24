import { getTranslations, setRequestLocale } from "next-intl/server";
import { CountryTile } from "@/components/CountryTile";
import { CourseCard } from "@/components/CourseCard";
import { cardInclude } from "@/lib/catalog";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("catalog");

  const [countries, skills] = await Promise.all([
    db.country.findMany({ orderBy: { order: "asc" } }),
    db.course.findMany({ where: { kind: "SKILL", published: true }, orderBy: { titleEn: "asc" }, include: cardInclude(new Date()) }),
  ]);
  const tab = "rounded-full border-[1.5px] border-ink px-4 py-2 font-display font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-marker";

  return (
    <main>
      <section className="border-b border-hairline">
        <div className="mx-auto grid max-w-5xl gap-3 px-4 py-10">
          <p className="font-display text-small font-semibold text-pen">{t("eyebrow")}</p>
          <h1 className="font-display text-h1 font-extrabold">{t.rich("pickCountry", { m: (c) => <span className="marker">{c}</span> })}</h1>
          <p className="max-w-[60ch] text-ink-muted">{t("pickCountryLede")}</p>
          <nav className="mt-2 flex flex-wrap gap-3">
            <a href="#school" className={tab}>
              {t("schoolTab")}
            </a>
            <a href="#skills" className={tab}>
              {t("skillTab")}
            </a>
          </nav>
        </div>
      </section>
      <div className="mx-auto grid max-w-5xl gap-12 px-4 py-10">
        <ul id="school" className="grid scroll-mt-24 grid-cols-2 gap-4 lg:grid-cols-4">
          {countries.map((c) => (
            <li key={c.id}>
              <CountryTile country={c} locale={locale} />
            </li>
          ))}
        </ul>
        <section id="skills" className="grid scroll-mt-24 gap-4 border-t border-hairline pt-10">
          <h2 className="font-display text-h2 font-semibold">{t("skillTab")}</h2>
          {skills.length ? (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {skills.map((c) => (
                <li key={c.id}>
                  <CourseCard course={c} locale={locale} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-muted">{t("skillEmpty")}</p>
          )}
        </section>
      </div>
    </main>
  );
}
