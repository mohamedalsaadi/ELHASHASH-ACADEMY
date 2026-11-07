import { Motion } from "@/components/motion/Motion";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CountryTile } from "@/components/CountryTile";
import { CourseCard } from "@/components/CourseCard";
import { EmptyState } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";
import { cardInclude } from "@/lib/catalog";
import { matchesQuery } from "@/lib/arabic-search";
import { db } from "@/lib/db";
import { alternates } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  return { title: t("title"), alternates: alternates(locale, "/courses") };
}

export default async function CoursesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const q = (await searchParams).q?.trim() ?? "";
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const now = new Date();

  const [countries, skills, results] = await Promise.all([
    db.country.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      include: { _count: { select: { grades: { where: { active: true } } } } },
    }),
    db.course.findMany({ where: { kind: "SKILL", published: true }, orderBy: { titleEn: "asc" }, include: cardInclude(now) }),
    q.length >= 2
      ? db.course
          .findMany({
            where: { published: true },
            orderBy: { createdAt: "desc" },
            // Folded in memory rather than in SQL: Postgres `contains` cannot see through the
            // alef/taa-marbuta/tatweel variants an Arabic query is written with.
            // ponytail: fine while the catalogue is small; add a normalised column or pg_trgm past a few thousand rows.
            take: 500,
            include: cardInclude(now),
          })
          .then((rows) =>
            rows
              .filter((c) =>
                matchesQuery(
                  [
                    c.titleAr,
                    c.titleEn,
                    c.descAr,
                    c.descEn,
                    c.subject?.nameAr,
                    c.subject?.nameEn,
                    c.grade?.nameAr,
                    c.grade?.nameEn,
                    c.instructor?.name,
                  ],
                  q,
                ),
              )
              .slice(0, 24),
          )
      : Promise.resolve([]),
  ]);

  return (
    <main>
      <Motion />
      <section className="mx-auto grid max-w-3xl justify-items-center gap-5 px-4 pt-16 pb-12 text-center md:pt-24">
        <p className="text-small font-medium text-ink-muted">{t("eyebrow")}</p>
        <h1 className="font-display text-display leading-[1.15] font-bold">{t.rich("pickCountry", { m: (c) => c })}</h1>
        <p className="max-w-[52ch] text-lede text-ink-muted">{t("pickCountryLede")}</p>
        <form method="get" className="mt-2 flex w-full max-w-xl items-center gap-2" role="search">
          <label className="grid min-w-0 flex-1">
            <span className="sr-only">{t("search")}</span>
            <input
              name="q"
              type="search"
              defaultValue={q}
              minLength={2}
              maxLength={80}
              placeholder={t("searchPlaceholder")}
              className="min-h-11 w-full rounded-full border border-field bg-surface px-5 text-body text-ink"
            />
          </label>
          <button className="btn btn-primary">{t("searchButton")}</button>
        </form>
      </section>

      {q.length >= 2 && (
        <section id="results">
          <div className="mx-auto grid max-w-(--container-page) gap-6 px-4 pb-16">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-h2 font-bold">{t("searchResults", { count: results.length })}</h2>
              <Link href="/courses" className="text-small text-pen underline-offset-4 hover:underline">
                {t("searchClear")}
              </Link>
            </div>
            {results.length ? (
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((c) => (
                  <li key={c.id}>
                    <CourseCard course={c} locale={locale} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-muted">{t("searchEmpty")}</p>
            )}
          </div>
        </section>
      )}
      <div className="mx-auto grid max-w-(--container-page) gap-20 px-4 pb-10">
        <ul id="school" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {countries.map((c) => (
            <li key={c.id}>
              <CountryTile country={c} locale={locale} />
            </li>
          ))}
        </ul>
        {countries.length === 0 && (
          <EmptyState>
            <p className="text-ink-muted">{t("noCountries")}</p>
          </EmptyState>
        )}
        <section id="skills" data-reveal="" className="grid gap-6">
          <h2 className="font-display text-h1 font-bold">{t("skillTab")}</h2>
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
