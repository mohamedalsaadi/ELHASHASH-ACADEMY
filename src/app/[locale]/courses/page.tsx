import { pick } from "@/lib/content";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CountryTile } from "@/components/CountryTile";
import { CourseCard } from "@/components/CourseCard";
import { EmptyState } from "@/components/brand/Mark";
import { Network } from "@/components/brand/Network";
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
  const tab = "btn btn-outline font-display";
  const ar = locale === "ar";

  return (
    <main>
      <section className="border-b border-hairline">
        <div className="mx-auto grid max-w-5xl gap-3 px-4 pt-12 pb-10">
          <p className="font-display text-small font-semibold text-pen">{t("eyebrow")}</p>
          <h1 className="font-display text-display font-bold">{t.rich("pickCountry", { m: (c) => <span className="marker">{c}</span> })}</h1>
          <p className="max-w-[60ch] text-ink-muted">{t("pickCountryLede")}</p>
          <nav className="mt-2 flex flex-wrap gap-3">
            <a href="#school" className={tab}>
              {t("schoolTab")}
            </a>
            <a href="#skills" className={tab}>
              {t("skillTab")}
            </a>
          </nav>
          <form method="get" className="mt-3 flex flex-wrap items-end gap-2" role="search">
            <label className="grid flex-1 gap-1 text-label text-ink-muted">
              {t("search")}
              <input
                name="q"
                type="search"
                defaultValue={q}
                minLength={2}
                maxLength={80}
                placeholder={t("searchPlaceholder")}
                className="min-h-11 rounded-full border border-field bg-surface px-5 text-body text-ink"
              />
            </label>
            <button className="btn btn-primary font-display">{t("searchButton")}</button>
          </form>
        </div>
      </section>

      {q.length >= 2 && (
        <section id="results" className="border-b border-hairline">
          <div className="mx-auto grid max-w-5xl gap-4 px-4 py-8">
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
      <div className="mx-auto grid max-w-5xl gap-12 px-4 py-10">
        {/* The trail map: one trail per country from the catalogue, dashed until it has a grade. Hover lights one trail. */}
        {countries.length > 0 && (
          <Network
            label={t("mapLabel")}
            className="reveal card hidden w-full p-4 sm:block"
            lines={countries.map((c) => ({
              code: c.code,
              inService: c._count.grades > 0,
              stations: [{ label: pick(ar, c.nameAr, c.nameEn), href: `/courses/c/${c.code.toLowerCase()}` }],
            }))}
          />
        )}
        <ul id="school" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        <section id="skills" className="reveal grid gap-4 border-t border-hairline pt-10">
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
