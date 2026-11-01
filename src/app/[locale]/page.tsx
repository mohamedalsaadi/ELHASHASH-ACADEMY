import type { Metadata } from "next";
import { BookOpenCheck, CalendarClock, Languages, LockKeyhole, Radio, Smartphone, Unlock } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { Intro } from "@/components/brand/Intro";
import { CountryTile } from "@/components/CountryTile";
import { CourseCard } from "@/components/CourseCard";
import { JsonLd } from "@/components/JsonLd";
import { PromoBand } from "@/components/PromoBand";
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

const button =
  "inline-flex items-center justify-center rounded-md px-6 py-3.5 font-display font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out)";

function getHome() {
  const published = { published: true };
  const now = new Date();
  return Promise.all([
    db.country.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      include: { _count: { select: { grades: { where: { active: true } } } } },
    }),
    db.course.findMany({ where: { kind: "SKILL", ...published }, orderBy: { createdAt: "desc" }, take: 3, include: cardInclude(now) }),
    db.promotion.findMany({
      where: {
        active: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      orderBy: { order: "asc" },
    }),
    Promise.all([
      db.course.count({ where: { published: true } }),
      db.lesson.count({ where: { unit: { course: { published: true } } } }),
      db.subject.count({ where: { active: true, courses: { some: { published: true } } } }),
    ]),
  ]);
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, [countries, skills, promos, [courseCount, lessonCount, subjectCount]]] = await Promise.all([getTranslations("home"), getHome()]);
  const ar = locale === "ar";
  const bar = promos.filter((p) => p.placement === "BAR");
  const cards = promos.filter((p) => p.placement === "CARD");
  const stats = [
    { key: "courses", value: courseCount },
    { key: "lessons", value: lessonCount },
    { key: "subjects", value: subjectCount },
  ].filter((s) => s.value > 0);

  const ways = [
    { key: "subscribe", Icon: BookOpenCheck, soon: false },
    { key: "rent", Icon: CalendarClock, soon: false },
    { key: "live", Icon: Radio, soon: false },
  ] as const;
  const trust = [
    { key: "free", Icon: Unlock },
    { key: "device", Icon: Smartphone },
    { key: "pay", Icon: LockKeyhole },
    { key: "lang", Icon: Languages },
  ] as const;

  const jsonLd = [
    { "@context": "https://schema.org", "@type": "Organization", name: "A+ Academy", url: siteUrl, logo: `${siteUrl}/icon.svg` },
    { "@context": "https://schema.org", "@type": "WebSite", name: "A+ Academy", url: siteUrl, inLanguage: ["ar", "en"] },
  ];

  return (
    <main>
      <JsonLd data={jsonLd} />
      <Intro skipLabel={t("skipIntro")} />
      <PromoBand
        promos={bar}
        locale={locale}
        variant="BAR"
        label={t("promotions")}
        fallback={{ text: t("announce"), cta: t("announceCta") }}
      />

      <section className="border-b border-hairline">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 md:grid-cols-[1.35fr_1fr] md:py-24">
          <div className="grid gap-6">
            <p className="font-medium text-pen">{t("eyebrow")}</p>
            <h1 className="font-display text-hero leading-[1.15] font-bold text-balance">
              {t.rich("headline", { m: (c) => <span className="marker">{c}</span> })}
            </h1>
            <p className="max-w-[52ch] text-[1.125rem] text-ink-muted">{t("lede")}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/courses" className={`${button} bg-primary text-on-primary hover:bg-[color-mix(in_oklab,var(--color-primary)_84%,#000)]`}>
                {t("ctaFree")}
              </Link>
              <a href="#grades" className={`${button} border-strong border-ink hover:bg-raised`}>
                {t("ctaGrade")}
              </a>
            </div>
          </div>

          {/* A sample result card on night: the brand's promise that every lesson ends with a mark, as a number.
              The folded corner and its gold ribbon sit on the wrapper, because .fold's clip-path would cut them. */}
          <div
            aria-hidden="true"
            className="page-corner mx-auto w-full max-w-[420px] [--cut:34px] [--page-corner-back:color-mix(in_oklab,var(--color-night)_78%,var(--color-ground))]"
          >
            <div className="fold grid gap-5 bg-night p-7 text-on-primary shadow-paper">
              <span className="flex items-center justify-between gap-2 text-small text-night-text">
                {t("paper.label")}
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-label text-night-text">{t("paper.sample")}</span>
              </span>
              <span className="font-display text-h3 font-semibold">{t("paper.q")}</span>
              <span className="flex items-end justify-between gap-3">
                <span className="num text-[3.4rem] leading-none font-semibold">
                  48<span className="text-h3 font-normal text-night-muted"> / 50</span>
                </span>
                <span className="rounded-sm bg-marker px-2.5 py-1 text-label font-semibold text-ink">{t("paper.score")}</span>
              </span>
              <span className="h-1.5 bg-white/15"><span className="block h-full w-[96%] bg-marker" /></span>
              <span className="flex gap-1">
                {Array.from({ length: 10 }, (_, i) => (
                  <i key={i} className={`h-5 w-4 [clip-path:polygon(50%_0,100%_100%,0_100%)] ${i < 6 ? "bg-primary" : i === 6 ? "bg-marker" : "bg-white/20"}`} />
                ))}
              </span>
            </div>
          </div>
        </div>
      </section>

      <PromoBand promos={cards} locale={locale} variant="CARD" label={t("promotions")} />

      <div className="mx-auto grid max-w-6xl gap-20 px-4 py-16">
        <section className="grid gap-6">
          <h2 className="font-display text-h1 font-extrabold">{t("ways.title")}</h2>
          <ul className="grid gap-5 md:grid-cols-3">
            {ways.map(({ key, Icon, soon }) => (
              <li key={key} className="grid content-start gap-3 rounded-lg border border-hairline bg-surface p-6 shadow-paper">
                <span className="flex items-center justify-between">
                  <Icon aria-hidden="true" className="size-8 text-pen" strokeWidth={1.75} />
                  {soon && <span className="rounded-full bg-raised px-2.5 py-0.5 text-label text-ink-muted">{t("ways.soon")}</span>}
                </span>
                <h3 className="font-display text-h3 font-bold">{t(`ways.${key}.title`)}</h3>
                <p className="text-ink-muted">{t(`ways.${key}.body`)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="grades" className="grid scroll-mt-6 gap-6">
          <h2 className="font-display text-h1 font-extrabold">{t("grades.title")}</h2>
          <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
        </section>

        {skills.length > 0 && (
          <section className="grid gap-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="grid gap-2">
                <h2 className="font-display text-h1 font-extrabold">{t("skills.title")}</h2>
                <p className="text-ink-muted">{t("skills.lede")}</p>
              </div>
              <Link href="/courses#skills" className="font-semibold underline decoration-pen decoration-2 underline-offset-4">
                {t("skills.all")}
              </Link>
            </div>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {skills.map((c) => (
                <li key={c.id}>
                  <CourseCard course={c} locale={locale} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {stats.length > 0 && (
          <ul className="grid gap-4 rounded-lg bg-raised p-5 sm:grid-cols-3">
            {stats.map((s) => (
              <li key={s.key} className="grid gap-0.5">
                <span className="num font-display text-h2 font-bold">{s.value}</span>
                <span className="text-small text-ink-muted">{t(`stats.${s.key}`, { count: s.value })}</span>
              </li>
            ))}
          </ul>
        )}

        <ul className="grid gap-4 rounded-lg bg-night p-6 text-on-primary sm:grid-cols-2 lg:grid-cols-4">
          {trust.map(({ key, Icon }) => (
            <li key={key} className="flex items-center gap-3">
              <Icon aria-hidden="true" className="size-6 shrink-0 text-marker" strokeWidth={1.75} />
              <span className="text-small">{t(`trust.${key}`)}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
