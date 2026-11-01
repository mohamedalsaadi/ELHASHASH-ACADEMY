import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, BookOpenCheck, ChartNoAxesColumnIncreasing, Presentation } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { Intro } from "@/components/brand/Intro";
import { CountryTile } from "@/components/CountryTile";
import { CourseCard } from "@/components/CourseCard";
import { JsonLd } from "@/components/JsonLd";
import { PromoBand } from "@/components/PromoBand";
import { Constellation } from "@/components/three/Constellation";
import { Link } from "@/i18n/navigation";
import { cardInclude } from "@/lib/catalog";
import { db } from "@/lib/db";
import { alternates, siteUrl } from "@/lib/seo";

// Catalog data changes rarely; a five-minute cache keeps the home page fast.
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternates(locale) };
}

function getHome() {
  const published = { published: true };
  const now = new Date();
  return Promise.all([
    db.country.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      select: { code: true, nameAr: true, nameEn: true, currency: true, _count: { select: { grades: { where: { active: true } } } } },
    }),
    db.course.findMany({ where: published, orderBy: { createdAt: "desc" }, take: 3, include: cardInclude(now) }),
    db.promotion.findMany({
      where: {
        active: true,
        placement: "CARD",
        AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
      orderBy: { order: "asc" },
    }),
    Promise.all([
      db.course.count({ where: published }),
      db.lesson.count({ where: { unit: { course: published } } }),
      db.subject.count({ where: { active: true, courses: { some: published } } }),
      db.user.count({ where: { courses: { some: published } } }),
    ]),
  ]);
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, [countries, latest, cards, [courseCount, lessonCount, subjectCount, teacherCount]]] = await Promise.all([
    getTranslations("home"),
    getHome(),
  ]);
  const ar = locale === "ar";
  const Arrow = ar ? ArrowLeft : ArrowRight;

  // Real counts only; zeros are left out rather than shown.
  const stats = [
    { key: "courses", value: courseCount },
    { key: "lessons", value: lessonCount },
    { key: "subjects", value: subjectCount },
    { key: "teachers", value: teacherCount },
  ].filter((s) => s.value > 0);

  const roles = [
    { key: "student", href: "/courses", Icon: BookOpenCheck },
    { key: "parent", href: "/signup?type=PARENT", Icon: ChartNoAxesColumnIncreasing },
    { key: "teacher", href: "/contact", Icon: Presentation },
  ] as const;

  const jsonLd = [
    { "@context": "https://schema.org", "@type": "Organization", name: "A+ Academy", url: siteUrl, logo: `${siteUrl}/icon.svg` },
    { "@context": "https://schema.org", "@type": "WebSite", name: "A+ Academy", url: siteUrl, inLanguage: ["ar", "en"] },
  ];

  return (
    <main>
      <JsonLd data={jsonLd} />

      {/* The night stage: the constellation behind, the copy on the start side. On a phone the globe sits above the copy. */}
      <section className="stage">
        <Constellation codes={countries.map((c) => c.code)} rtl={ar} />
        <Intro skipLabel={t("skipIntro")} />
        <div className="relative mx-auto grid min-h-[min(92svh,56rem)] max-w-(--container-page) content-end px-4 pt-[min(52vw,20rem)] pb-14 md:pt-28 md:pb-20">
          <div className="as-hero-copy grid max-w-[38rem] gap-6">
            <span className="text-label font-medium tracking-wide text-night-muted" style={{ "--i": 0 } as React.CSSProperties}>
              {t("eyebrow")}
            </span>
            <h1 className="font-display text-hero leading-[1.05] font-bold" style={{ "--i": 1 } as React.CSSProperties}>
              {t.rich("headline", {
                a: (chunks) => (
                  <bdi dir="ltr" className="marker">
                    {chunks}
                  </bdi>
                ),
              })}
            </h1>
            <p className="max-w-[36rem] text-[1.1875rem] text-night-muted" style={{ "--i": 2 } as React.CSSProperties}>
              {t("lede")}
            </p>
            <div className="flex flex-wrap gap-3" style={{ "--i": 3 } as React.CSSProperties}>
              <Link href="/courses" className="btn btn-glow">
                {t("ctaStart")}
                <Arrow aria-hidden="true" className="size-4" strokeWidth={2.5} />
              </Link>
              <a href="#roles" className="btn btn-ghost">
                {t("ctaParent")}
              </a>
            </div>
            {stats.length > 0 && (
              <ul aria-label={t("statsLabel")} className="mt-4 flex flex-wrap gap-x-10 gap-y-4" style={{ "--i": 4 } as React.CSSProperties}>
                {stats.map((s) => (
                  <li key={s.key} className="grid">
                    <span className="num font-display text-figure leading-tight font-semibold">{s.value}</span>
                    <span className="text-small text-night-muted">{t(`legend.units.${s.key}`)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-(--container-page) gap-24 px-4 py-20 md:gap-32 md:py-28">
        <section id="lines" className="reveal grid scroll-mt-24 gap-8">
          <div className="grid gap-3">
            <h2 className="font-display text-display leading-tight font-bold">{t("lines.title")}</h2>
            <p className="max-w-[56ch] text-[1.125rem] text-ink-muted">{t("lines.lede")}</p>
          </div>
          {countries.length === 0 ? (
            <EmptyState>
              <p className="text-ink-muted">{t("noCountries")}</p>
            </EmptyState>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {countries.map((c) => (
                <li key={c.code}>
                  <CountryTile country={c} locale={locale} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* One tile per role, Stripe-style bento: the student tile is the dark, wide one. */}
        <section id="roles" className="reveal grid scroll-mt-24 gap-8">
          <h2 className="max-w-[24ch] font-display text-display leading-tight font-bold">{t("roles.title")}</h2>
          <ul className="grid gap-5 md:grid-cols-6">
            {roles.map(({ key, href, Icon }, i) => (
              <li
                key={key}
                className={`relative isolate grid content-start gap-3 overflow-hidden rounded-lg p-7 md:p-9 ${
                  i === 0 ? "stage md:col-span-6 lg:col-span-4 lg:row-span-2" : "card md:col-span-3 lg:col-span-2"
                }`}
              >
                <Icon aria-hidden="true" className={`size-7 ${i === 0 ? "text-aurora-3" : "text-primary"}`} strokeWidth={1.75} />
                <span className={`text-label font-medium tracking-wide ${i === 0 ? "text-night-muted" : "text-ink-muted"}`}>{t(`roles.${key}.k`)}</span>
                <h3 className={`font-display font-bold ${i === 0 ? "text-display leading-tight" : "text-h2"}`}>{t(`roles.${key}.t`)}</h3>
                <p className={`max-w-[44ch] ${i === 0 ? "text-[1.125rem] text-night-muted" : "text-ink-muted"}`}>{t(`roles.${key}.b`)}</p>
                <Link href={href} className={`btn mt-3 justify-self-start ${i === 0 ? "btn-glow" : "btn-outline"}`}>
                  {t(`roles.${key}.cta`)}
                  <Arrow aria-hidden="true" className="size-4" strokeWidth={2.5} />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {latest.length > 0 && (
          <section className="reveal grid gap-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-display leading-tight font-bold">{t("latest.title")}</h2>
              <Link href="/courses" className="btn btn-outline">
                {t("latest.all")}
                <Arrow aria-hidden="true" className="size-4" strokeWidth={2.5} />
              </Link>
            </div>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {latest.map((c) => (
                <li key={c.id}>
                  <CourseCard course={c} locale={locale} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <PromoBand promos={cards} locale={locale} variant="CARD" label={t("promotions")} />

        {/* How it works: four stops, the order is the journey. */}
        <section className="reveal grid gap-8">
          <h2 className="font-display text-display leading-tight font-bold">{t("how.title")}</h2>
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {(["s1", "s2", "s3", "s4"] as const).map((s, i) => (
              <li key={s} className="card grid content-start gap-2 p-6">
                <span className="num font-display text-h2 font-bold text-primary">{i + 1}</span>
                <h3 className="font-display text-h3 font-bold">{t(`how.${s}.t`)}</h3>
                <p className="text-ink-muted">{t(`how.${s}.b`)}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* "Three ways to learn" (subscribe, rent, live) is hidden while teachers set their own courses and prices
            (temporary marketplace stage, to end of 2026). The strings stay in messages/*.json under home.ways. */}

        <section className="stage reveal grid justify-items-center gap-5 rounded-lg px-6 py-16 text-center md:py-24">
          <h2 className="font-display text-display leading-tight font-bold">{t("final.title")}</h2>
          <p className="max-w-[44ch] text-[1.125rem] text-night-muted">{t("final.body")}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="btn btn-glow">
              {t("ctaStart")}
              <Arrow aria-hidden="true" className="size-4" strokeWidth={2.5} />
            </Link>
            <Link href="/faq" className="btn btn-ghost">
              {t("parent.faq")}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
