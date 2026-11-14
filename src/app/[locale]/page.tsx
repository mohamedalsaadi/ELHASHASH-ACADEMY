import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { ArrowLeft, ArrowRight, Check, Play } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { Intro } from "@/components/brand/Intro";
import { CountryTile } from "@/components/CountryTile";
import { CourseCard } from "@/components/CourseCard";
import { JsonLd } from "@/components/JsonLd";
import { Motion } from "@/components/motion/Motion";
import { PromoBand } from "@/components/PromoBand";
import { Link } from "@/i18n/navigation";
import { cardInclude } from "@/lib/catalog";
import { db } from "@/lib/db";
import { alternates, siteUrl } from "@/lib/seo";

// This route renders per request: the shared header reads the session, and any cookie read in the
// layout opts every route under it into dynamic rendering, so `revalidate` here would be inert.
// What can be cached is the catalogue itself, which is what the window below covers. Making the
// page itself cacheable means moving the session out of the header; that is its own change.

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternates(locale) };
}

function loadHome() {
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

// Production only: in dev a five-minute cache hides edits you are trying to see.
const getHome = process.env.NODE_ENV === "production" ? unstable_cache(loadHome, ["home-catalogue"], { revalidate: 300 }) : loadHome;

// unstable_cache JSON-parses every hit, so the dates arrive as strings; pricing compares them with a Date.
const revive = (d: Date | null) => (d ? new Date(d) : d);
function reviveSkuDates<C extends Awaited<ReturnType<typeof loadHome>>[1][number]>(course: C): C {
  return { ...course, skus: course.skus.map((s) => ({ ...s, discountFrom: revive(s.discountFrom), discountTo: revive(s.discountTo), saleFrom: revive(s.saleFrom), saleTo: revive(s.saleTo) })) };
}

type T = Awaited<ReturnType<typeof getTranslations<"home">>>;

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, [countries, cachedLatest, cards, [courseCount, lessonCount, subjectCount, teacherCount]]] = await Promise.all([
    getTranslations("home"),
    getHome(),
  ]);
  const latest = cachedLatest.map(reviveSkuDates);
  const ar = locale === "ar";
  const Arrow = ar ? ArrowLeft : ArrowRight;

  // Real counts only; zeros are left out rather than shown.
  const stats = [
    { key: "courses", value: courseCount },
    { key: "lessons", value: lessonCount },
    { key: "subjects", value: subjectCount },
    { key: "teachers", value: teacherCount },
  ].filter((s) => s.value > 0);

  const jsonLd = [
    { "@context": "https://schema.org", "@type": "Organization", name: "Dhirwa", url: siteUrl, logo: `${siteUrl}/icon.svg` },
    { "@context": "https://schema.org", "@type": "WebSite", name: "Dhirwa", url: siteUrl, inLanguage: ["ar", "en"] },
  ];

  const steps = [
    { key: "lesson", Panel: LessonPanel },
    { key: "exam", Panel: ExamPanel },
    { key: "progress", Panel: ProgressPanel },
  ] as const;

  return (
    <main className="overflow-x-clip">
      <JsonLd data={jsonLd} />
      <Intro skipLabel={t("skipIntro")} rtl={ar} />
      <Motion />

      <section className="mx-auto grid max-w-(--container-page) justify-items-center px-4 pt-20 pb-16 text-center md:pt-32">
        <div className="as-hero-copy grid justify-items-center gap-6">
          <span className="text-small font-medium text-ink-muted" style={{ "--i": 0 } as React.CSSProperties}>
            {t("eyebrow")}
          </span>
          <h1 className="max-w-[16ch] font-display text-hero leading-[1.08] font-bold" style={{ "--i": 1 } as React.CSSProperties}>
            {t("headline")}
          </h1>
          <p className="max-w-[40rem] text-lede text-ink-muted" style={{ "--i": 2 } as React.CSSProperties}>
            {t("lede")}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3" style={{ "--i": 3 } as React.CSSProperties}>
            <Link href="/courses" className="btn btn-primary">
              {t("ctaStart")}
              <Arrow aria-hidden="true" className="size-4" strokeWidth={2.25} />
            </Link>
            <a href="#roles" className="btn btn-outline">
              {t("ctaParent")}
            </a>
          </div>
          {stats.length > 0 && (
            <ul aria-label={t("statsLabel")} className="mt-8 flex flex-wrap justify-center gap-x-12 gap-y-4" style={{ "--i": 4 } as React.CSSProperties}>
              {stats.map((s) => (
                <li key={s.key} className="grid justify-items-center">
                  <span className="num font-display text-figure leading-tight font-semibold">{s.value}</span>
                  <span className="text-small text-ink-muted">{t(`legend.units.${s.key}`)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* The product, not a picture of a mood. Labelled as an example: every number on it is sample data. */}
      <div className="mx-auto max-w-5xl px-4">
        <div data-scale-in="" className="card grid gap-6 p-5 md:grid-cols-2 md:p-10">
          <LessonPanel t={t} />
          <ProgressPanel t={t} />
        </div>
      </div>

      <section id="lines" className="mx-auto grid max-w-(--container-page) gap-10 px-4 pt-28 md:pt-40 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div className="grid content-start gap-4 lg:sticky lg:top-28 lg:self-start">
          <h2 className="font-display text-display leading-[1.15] font-bold">{t("climb.c1.t")}</h2>
          <p className="max-w-[44ch] text-lede text-ink-muted">{t("climb.c1.b")}</p>
        </div>
        {countries.length === 0 ? (
          <EmptyState>
            <p className="text-ink-muted">{t("noCountries")}</p>
          </EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {countries.map((c) => (
              <li key={c.code} data-reveal="">
                <CountryTile country={c} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mx-auto grid max-w-(--container-page) gap-10 px-4 pt-28 md:pt-40">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="grid gap-4">
            <h2 className="font-display text-display leading-[1.15] font-bold">{t("climb.c2.t")}</h2>
            <p className="max-w-[52ch] text-lede text-ink-muted">{t("climb.c2.b")}</p>
          </div>
          <Link href="/courses" className="btn btn-outline">
            {t("latest.all")}
            <Arrow aria-hidden="true" className="size-4" strokeWidth={2.25} />
          </Link>
        </div>
        {latest.length > 0 && (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((c) => (
              <li key={c.id} data-reveal="">
                <CourseCard course={c} locale={locale} />
              </li>
            ))}
          </ul>
        )}
        <PromoBand promos={cards} locale={locale} variant="CARD" label={t("promotions")} />
      </section>

      {/* From lesson to mark: the text scrolls, the panel stays. Phones read each panel under its text. */}
      <section data-steps="" className="mx-auto mt-28 grid max-w-(--container-page) gap-x-16 px-4 md:mt-40 lg:grid-cols-2">
        <div className="grid gap-16 lg:gap-0">
          <h2 className="font-display text-display leading-[1.15] font-bold lg:pb-24">{t("steps.title")}</h2>
          {steps.map(({ key, Panel }) => (
            <div key={key} data-step="" className="grid content-center gap-4 lg:min-h-[70svh]">
              <h3 className="font-display text-h1 font-bold">{t(`steps.${key}.t`)}</h3>
              <p className="max-w-[44ch] text-lede text-ink-muted">{t(`steps.${key}.b`)}</p>
              <div className="card mt-2 p-5 lg:hidden">
                <Panel t={t} />
              </div>
            </div>
          ))}
        </div>
        <div aria-hidden="true" className="sticky top-28 hidden h-[calc(100svh-9rem)] max-h-[36rem] self-start lg:block">
          <div className="card relative h-full overflow-hidden">
            {steps.map(({ key, Panel }) => (
              <div key={key} data-panel="" className="grid content-center p-10">
                <Panel t={t} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="roles" className="mx-auto grid max-w-(--container-page) gap-10 px-4 pt-28 md:pt-40">
        <h2 className="max-w-[20ch] font-display text-display leading-[1.15] font-bold">{t("roles.title")}</h2>
        <ul className="grid gap-5 md:grid-cols-3">
          {(
            [
              { key: "student", href: "/courses" },
              { key: "parent", href: "/signup?type=PARENT" },
              { key: "teacher", href: "/teach" },
            ] as const
          ).map(({ key, href }) => (
            <li key={key} data-reveal="" className="card grid content-start gap-3 p-7">
              <span className="text-small font-medium text-ink-muted">{t(`roles.${key}.k`)}</span>
              <h3 className="font-display text-h2 font-bold">{t(`roles.${key}.t`)}</h3>
              <p className="text-ink-muted">{t(`roles.${key}.b`)}</p>
              <Link href={href} className="mt-2 inline-flex min-h-11 items-center gap-2 justify-self-start font-semibold underline-offset-4 hover:underline">
                {t(`roles.${key}.cta`)}
                <Arrow aria-hidden="true" className="size-4" strokeWidth={2.25} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto grid max-w-3xl justify-items-center gap-6 px-4 pt-28 text-center md:pt-44">
        <span aria-hidden="true" className="size-3 rounded-full bg-summit shadow-glow" />
        <h2 className="font-display text-display leading-[1.15] font-bold">{t("final.title")}</h2>
        <p className="max-w-[44ch] text-lede text-ink-muted">{t("final.body")}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/signup" className="btn btn-primary">
            {t("ctaStart")}
            <Arrow aria-hidden="true" className="size-4" strokeWidth={2.25} />
          </Link>
          <Link href="/faq" className="btn btn-outline">
            {t("parent.faq")}
          </Link>
        </div>
      </section>
    </main>
  );
}

function Example({ t }: { t: T }) {
  return <span className="justify-self-start rounded-full bg-raised px-2.5 py-0.5 text-label font-medium text-ink-muted">{t("sample.label")}</span>;
}

function LessonPanel({ t }: { t: T }) {
  return (
    <div className="grid gap-4">
      <Example t={t} />
      <p className="font-display text-h3 font-bold">{t("sample.unit")}</p>
      <ul className="grid gap-1">
        {(["a", "b", "c"] as const).map((k, i) => (
          <li key={k} className="flex items-center gap-3 rounded-(--radius-sm) py-2">
            <span className={`grid size-8 shrink-0 place-items-center rounded-full ${i === 0 ? "bg-primary text-on-primary" : "bg-raised text-ink-muted"}`}>
              {i === 0 ? <Check aria-hidden="true" className="size-4" /> : <Play aria-hidden="true" className="size-3.5" />}
            </span>
            <span className="min-w-0 flex-1">{t(`sample.lessons.${k}`)}</span>
            <span className="num text-small text-ink-muted">{[12, 18, 25][i]}:00</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExamPanel({ t }: { t: T }) {
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <Example t={t} />
        <span className="num text-small font-semibold">14:32</span>
      </div>
      <p className="font-display text-h3 font-bold">{t("sample.question")}</p>
      <ul className="grid gap-2">
        {["3", "4", "5"].map((a) => (
          <li key={a} className={`num flex min-h-11 items-center justify-between rounded-(--radius-md) border px-4 ${a === "4" ? "border-ink font-semibold" : "border-hairline text-ink-muted"}`}>
            {a}
            {a === "4" && <Check aria-hidden="true" className="size-4" />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProgressPanel({ t }: { t: T }) {
  return (
    <div className="grid gap-4">
      <Example t={t} />
      <p className="flex items-baseline gap-3">
        <span className="num font-display text-[3.5rem] leading-none font-bold">81</span>
        <span className="text-ink-muted">/ 100 · {t("sample.tier")}</span>
      </p>
      <ul className="grid gap-3">
        {[
          { k: "a", v: 92, gold: true },
          { k: "b", v: 74, gold: false },
        ].map(({ k, v, gold }) => (
          <li key={k} className="grid gap-1.5 text-small">
            <span className="flex justify-between gap-3">
              {t(`sample.concepts.${k}`)}
              <span className="num font-semibold">{v}</span>
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-raised">
              <span className={`block h-full rounded-full ${gold ? "bg-summit" : "bg-ink-muted"}`} style={{ width: `${v}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
