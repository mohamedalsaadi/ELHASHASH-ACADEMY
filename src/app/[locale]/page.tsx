import type { Metadata } from "next";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Landmark } from "@/components/brand/Landmark";
import { EmptyState } from "@/components/brand/Mark";
import { Intro } from "@/components/brand/Intro";
import { LineBadge, Network, type NetLine } from "@/components/brand/Network";
import { CourseCard } from "@/components/CourseCard";
import { JsonLd } from "@/components/JsonLd";
import { PromoBand } from "@/components/PromoBand";
import { Link, getPathname } from "@/i18n/navigation";
import { cardInclude } from "@/lib/catalog";
import { KNOWN_COUNTRIES } from "@/lib/countries";
import { db } from "@/lib/db";
import { alternates, siteUrl } from "@/lib/seo";

// Catalog data changes rarely; a five-minute cache keeps the home page fast.
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternates(locale) };
}

// Platform signs: solid blocks, square corners, white type, an arrow. The one button language of the marketing pages.
const sign =
  "inline-flex min-h-(--control-h) items-center justify-between gap-6 px-5 py-3.5 font-display text-[1.0625rem] font-bold transition-colors duration-(--dur-fast) ease-(--ease-out)";

function getHome() {
  const published = { published: true };
  const now = new Date();
  return Promise.all([
    db.country.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      select: {
        id: true,
        code: true,
        nameAr: true,
        nameEn: true,
        grades: {
          where: { active: true, courses: { some: published } },
          orderBy: [{ order: "asc" }, { level: "asc" }],
          select: { level: true, nameAr: true, nameEn: true },
        },
        _count: { select: { grades: { where: { active: true } } } },
      },
    }),
    db.course.findMany({
      where: published,
      orderBy: { createdAt: "desc" },
      take: 3,
      include: cardInclude(now),
    }),
    db.promotion.findMany({
      where: {
        active: true,
        placement: "CARD",
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      orderBy: { order: "asc" },
    }),
    Promise.all([
      db.course.count({ where: published }),
      db.lesson.count({ where: { unit: { course: published } } }),
      db.subject.count({
        where: { active: true, courses: { some: published } },
      }),
      db.user.count({ where: { courses: { some: published } } }),
    ]),
  ]);
}

/** Lines in service take the two level slots first, so their station labels read straight. */
function toLines<T extends { inService: boolean }>(all: T[]): T[] {
  const open = all.filter((l) => l.inService);
  const rest = all.filter((l) => !l.inService);
  const out: T[] = [];
  if (open[0]) out.push(open.shift()!);
  if (rest[0]) out.push(rest.shift()!);
  if (open[0]) out.push(open.shift()!);
  return [...out, ...open, ...rest];
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [
    t,
    tc,
    [
      countries,
      latest,
      cards,
      [courseCount, lessonCount, subjectCount, teacherCount],
    ],
  ] = await Promise.all([
    getTranslations("home"),
    getTranslations("catalog"),
    getHome(),
  ]);
  const ar = locale === "ar";
  const Arrow = ar ? ArrowLeft : ArrowRight;

  const lines: (NetLine & { name: string; grades: number })[] = toLines(
    countries.map((c) => ({
      code: c.code,
      name: ar ? c.nameAr : c.nameEn,
      grades: c._count.grades,
      inService: c.grades.length > 0,
      stations: c.grades.slice(0, 3).map((g) => ({
        label: ar ? g.nameAr : g.nameEn,
        href: getPathname({
          href: `/courses/c/${c.code.toLowerCase()}/${g.level}`,
          locale,
        }),
      })),
    })),
  );
  const stats = [
    { key: "courses", value: courseCount },
    { key: "lessons", value: lessonCount },
    { key: "subjects", value: subjectCount },
    { key: "teachers", value: teacherCount },
  ].filter((s) => s.value > 0);

  const steps = ["s1", "s2", "s3", "s4"] as const;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "A+ Academy",
      url: siteUrl,
      logo: `${siteUrl}/icon.svg`,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "A+ Academy",
      url: siteUrl,
      inLanguage: ["ar", "en"],
    },
  ];

  return (
    <main>
      <JsonLd data={jsonLd} />
      <Intro
        skipLabel={t("skipIntro")}
        lines={lines.map(({ code, inService }) => ({ code, inService }))}
      />

      {/* First viewport: the copy column on the start side, the network on the end side; on a phone the map leads. */}
      <section className="border-b border-rule bg-surface">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 md:grid-cols-[minmax(0,30rem)_1fr] md:py-20">
          <div className="order-2 grid gap-6 md:order-1">
            <h1 className="font-display text-hero leading-[1.12] font-extrabold text-balance">
              {t("headline")}
            </h1>
            <p className="max-w-[46ch] text-[1.125rem] text-ink-muted">
              {t("lede")}
            </p>
            <div className="grid max-w-sm gap-3">
              <Link
                href="/courses"
                className={`${sign} bg-primary text-on-primary hover:bg-ink`}
              >
                {t("ctaStart")}
                <Arrow
                  aria-hidden="true"
                  className="size-5"
                  strokeWidth={2.5}
                />
              </Link>
              <a
                href="#parents"
                className={`${sign} bg-ink text-on-primary hover:bg-primary`}
              >
                {t("ctaParent")}
                <Arrow
                  aria-hidden="true"
                  className="size-5"
                  strokeWidth={2.5}
                />
              </a>
            </div>
          </div>
          <div className="order-1 md:order-2">
            <Network
              id="hero"
              lines={lines}
              label={t("mapLabel")}
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* The legend: the map's key and the catalogue's real counts. Zeros are left out. */}
      <section
        aria-labelledby="legend"
        className="border-b border-rule bg-surface"
      >
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-[auto_1fr] md:items-center md:gap-12">
          <div className="grid gap-3">
            <h2
              id="legend"
              className="font-display text-label font-bold text-ink-muted uppercase"
            >
              {t("legend.title")}
            </h2>
            <span className="flex items-center gap-3 text-small">
              <i aria-hidden="true" className="h-1.5 w-10 bg-ink" />
              {t("legend.open")}
            </span>
            <span className="flex items-center gap-3 text-small">
              <i
                aria-hidden="true"
                className="h-1.5 w-10 bg-[repeating-linear-gradient(90deg,var(--color-ink)_0_calc(var(--spacing)*2.5),transparent_calc(var(--spacing)*2.5)_calc(var(--spacing)*4))] rtl:bg-[repeating-linear-gradient(270deg,var(--color-ink)_0_calc(var(--spacing)*2.5),transparent_calc(var(--spacing)*2.5)_calc(var(--spacing)*4))]"
              />
              {t("legend.soon")}
            </span>
          </div>
          {stats.length > 0 && (
            <div className="grid gap-2">
              <ul className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
                {stats.map((s) => (
                  <li
                    key={s.key}
                    className="grid gap-0.5 border-s-(length:--line) border-ink ps-3"
                  >
                    <span className="num font-display text-figure leading-none font-bold">
                      {s.value}
                    </span>
                    <span className="text-small text-ink-muted">
                      {t(`legend.units.${s.key}`)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-label text-ink-muted">{t("legend.caption")}</p>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-20 px-4 py-16">
        <section id="lines" className="grid scroll-mt-6 gap-6">
          <div className="grid gap-2">
            <h2 className="font-display text-h1 font-extrabold">
              {t("lines.title")}
            </h2>
            <p className="max-w-[60ch] text-ink-muted">{t("lines.lede")}</p>
          </div>
          {lines.length === 0 ? (
            <EmptyState>
              <p className="text-ink-muted">{t("noCountries")}</p>
            </EmptyState>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lines.map((l) => (
                <li key={l.code}>
                  <Link
                    href={`/courses/c/${l.code.toLowerCase()}`}
                    className="group flex h-full items-center gap-4 border-2 border-ink bg-surface p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
                  >
                    <LineBadge code={l.code} />
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="flex items-center gap-2 font-display text-h3 font-bold">
                        {KNOWN_COUNTRIES.has(l.code) && (
                          <Image
                            src={`/flags/${l.code.toLowerCase()}.svg`}
                            alt=""
                            width={24}
                            height={18}
                            className="ring-1 ring-hairline"
                          />
                        )}
                        {l.name}
                      </span>
                      <span className="text-small text-ink-muted">
                        {l.inService
                          ? tc("gradeCount", { count: l.grades })
                          : t("lines.soon")}
                      </span>
                    </span>
                    <Landmark code={l.code} size={40} />
                    <Arrow
                      aria-hidden="true"
                      className="size-5 shrink-0 text-ink-muted transition-transform duration-(--dur-fast) ease-(--ease-out) group-hover:translate-x-1 rtl:group-hover:-translate-x-1"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* How it works, as a line with four stops. */}
        <section className="grid gap-8">
          <h2 className="font-display text-h1 font-extrabold">
            {t("how.title")}
          </h2>
          <ol className="relative grid gap-8 md:grid-cols-4 md:gap-6">
            <i
              aria-hidden="true"
              className="absolute inset-y-2 start-[calc(var(--spacing)*3-var(--line)/2)] w-[var(--line)] bg-primary md:inset-x-0 md:start-0 md:top-[calc(var(--spacing)*3-var(--line)/2)] md:bottom-auto md:h-[var(--line)] md:w-auto"
            />
            {steps.map((s) => (
              <li
                key={s}
                className="relative grid content-start gap-2 ps-10 md:ps-0 md:pt-10"
              >
                <i
                  aria-hidden="true"
                  className="absolute start-0 top-0 size-6 rounded-full border-4 border-ink bg-surface"
                />
                <h3 className="font-display text-h3 font-bold">
                  {t(`how.${s}.t`)}
                </h3>
                <p className="text-ink-muted">{t(`how.${s}.b`)}</p>
              </li>
            ))}
          </ol>
        </section>

        {latest.length > 0 && (
          <section className="grid gap-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-h1 font-extrabold">
                {t("latest.title")}
              </h2>
              <Link
                href="/courses"
                className="font-semibold underline decoration-primary decoration-2 underline-offset-4"
              >
                {t("latest.all")}
              </Link>
            </div>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {latest.map((c) => (
                <li key={c.id}>
                  <CourseCard course={c} locale={locale} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <PromoBand
          promos={cards}
          locale={locale}
          variant="CARD"
          label={t("promotions")}
        />

        {/* "Three ways to learn" (subscribe, rent, live) is hidden while teachers set their own courses and prices
            (temporary marketplace stage, to end of 2026). The strings stay in messages/*.json under home.ways. */}

        <section
          id="parents"
          aria-labelledby="parents-title"
          className="grid scroll-mt-6 gap-6 bg-night p-6 text-on-primary md:grid-cols-[1fr_auto] md:items-end md:p-10"
        >
          <div className="grid gap-3">
            <h2
              id="parents-title"
              className="font-display text-h1 font-extrabold"
            >
              {t("parent.title")}
            </h2>
            <p className="max-w-[56ch] text-night-text">{t("parent.body")}</p>
            <ul className="mt-2 grid gap-2 text-small text-night-text sm:grid-cols-2">
              {(["free", "device", "lang"] as const).map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <i
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full border-2 border-on-primary"
                  />
                  {t(`trust.${k}`)}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-3">
            <Link
              href="/courses"
              className={`${sign} bg-primary text-on-primary hover:bg-surface hover:text-ink`}
            >
              {t("parent.cta")}
              <Arrow aria-hidden="true" className="size-5" strokeWidth={2.5} />
            </Link>
            <Link
              href="/faq"
              className="font-semibold underline decoration-2 underline-offset-4"
            >
              {t("parent.faq")}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
