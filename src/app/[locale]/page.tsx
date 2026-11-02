import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, BookOpenCheck, ChartNoAxesColumnIncreasing } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { Intro } from "@/components/brand/Intro";
import { CountryTile } from "@/components/CountryTile";
import { CourseCard } from "@/components/CourseCard";
import { JsonLd } from "@/components/JsonLd";
import { PromoBand } from "@/components/PromoBand";
import { Summit } from "@/components/three/Summit";
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
  ] as const;

  const jsonLd = [
    { "@context": "https://schema.org", "@type": "Organization", name: "Dhirwa", url: siteUrl, logo: `${siteUrl}/icon.svg` },
    { "@context": "https://schema.org", "@type": "WebSite", name: "Dhirwa", url: siteUrl, inLanguage: ["ar", "en"] },
  ];

  return (
    <main>
      <JsonLd data={jsonLd} />

      {/* The map: the summit on the end side, the copy on the start side. On a phone the summit sits above the copy. */}
      <section className="stage">
        <Summit rtl={ar} />
        <Intro skipLabel={t("skipIntro")} />
        <div className="relative mx-auto grid min-h-[min(92svh,56rem)] max-w-(--container-page) content-end px-4 pt-[min(80vw,20rem)] pb-14 md:pt-28 md:pb-20">
          <div className="as-hero-copy grid max-w-[38rem] gap-6">
            <span className="text-label font-medium text-night-muted ltr:tracking-wide" style={{ "--i": 0 } as React.CSSProperties}>
              {t("eyebrow")}
            </span>
            <h1 className="font-display text-hero leading-[1.05] font-bold" style={{ "--i": 1 } as React.CSSProperties}>
              {t.rich("headline", {
                a: (chunks) => (
                  <span className="marker">{chunks}</span>
                ),
              })}
            </h1>
            <p className="max-w-[36rem] text-lede text-night-muted" style={{ "--i": 2 } as React.CSSProperties}>
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

      {/* The climb: every section is one stage of the trail, rising from base camp (low contour) to the summit (gold). */}
      <div className="mx-auto max-w-(--container-page) px-4 py-20 md:py-28">
        <ol aria-label={t("climb.label")} className="relative grid gap-24 before:absolute before:inset-y-2 before:start-1.5 before:border-s before:border-contour-5 md:gap-32">

          <li id="lines" className="reveal relative grid scroll-mt-24 gap-8 ps-8 md:ps-14">
            <Camp tone="bg-contour-1" />
            <Heading k={t("climb.c1.k")} title={t("climb.c1.t")} lede={t("climb.c1.b")} />
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
          </li>

          <li className="reveal relative grid gap-8 ps-8 md:ps-14">
            <Camp tone="bg-contour-2" />
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
              <Heading k={t("climb.c2.k")} title={t("climb.c2.t")} lede={t("climb.c2.b")} />
              <Link href="/courses" className="btn btn-outline">
                {t("latest.all")}
                <Arrow aria-hidden="true" className="size-4" strokeWidth={2.5} />
              </Link>
            </div>
            {latest.length > 0 && (
              <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {latest.map((c) => (
                  <li key={c.id}>
                    <CourseCard course={c} locale={locale} />
                  </li>
                ))}
              </ul>
            )}
            <PromoBand promos={cards} locale={locale} variant="CARD" label={t("promotions")} />
          </li>

          <li id="roles" className="reveal relative grid scroll-mt-24 gap-8 ps-8 md:ps-14">
            <Camp tone="bg-contour-3" />
            <Heading k={t("climb.c3.k")} title={t("climb.c3.t")} lede={t("climb.c3.b")} />
            <ul className="grid gap-5 md:grid-cols-2">
              {roles.map(({ key, href, Icon }) => (
                <li key={key} className="card grid content-start gap-3 p-7 md:p-9">
                  <Icon aria-hidden="true" className="size-7 text-primary" strokeWidth={1.75} />
                  <span className="text-label font-medium text-ink-muted">{t(`roles.${key}.k`)}</span>
                  <h3 className="font-display text-h2 font-bold">{t(`roles.${key}.t`)}</h3>
                  <p className="max-w-[44ch] text-ink-muted">{t(`roles.${key}.b`)}</p>
                  <Link href={href} className={`btn mt-3 justify-self-start ${key === "student" ? "btn-primary" : "btn-outline"}`}>
                    {t(`roles.${key}.cta`)}
                    <Arrow aria-hidden="true" className="size-4" strokeWidth={2.5} />
                  </Link>
                </li>
              ))}
            </ul>
          </li>

          {/* "Three ways to learn" (subscribe, rent, live) is hidden while teachers set their own courses and prices
              (temporary marketplace stage, to end of 2026). The strings stay in messages/*.json under home.ways. */}

          {/* The summit: the one closing night-map band, marked by the gold point at the top of the trail. */}
          <li className="reveal relative ps-8 md:ps-14">
            <Camp tone="bg-summit" />
            <section className="stage grid justify-items-center gap-5 rounded-lg px-6 py-16 text-center md:py-24">
              <span className="text-label font-medium text-night-muted">{t("climb.c4.k")}</span>
              <h2 className="font-display text-display leading-tight font-bold">
                {t.rich("final.title", { a: (chunks) => <span className="marker">{chunks}</span> })}
              </h2>
              <p className="max-w-[44ch] text-lede text-night-muted">{t("final.body")}</p>
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
          </li>
        </ol>
      </div>
    </main>
  );
}

/** A camp on the trail: a dot on the trail line, its colour climbing the elevation ramp. */
function Camp({ tone }: { tone: string }) {
  return <span aria-hidden="true" className={`absolute start-0 top-2 size-3 rounded-full ring-4 ring-ground ${tone}`} />;
}

function Heading({ k, title, lede }: { k: string; title: string; lede: string }) {
  return (
    <div className="grid gap-3">
      <span className="text-label font-medium text-ink-muted">{k}</span>
      <h2 className="font-display text-display leading-tight font-bold">{title}</h2>
      <p className="max-w-[56ch] text-lede text-ink-muted">{lede}</p>
    </div>
  );
}
