import { pick } from "@/lib/content";
import { Motion } from "@/components/motion/Motion";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { EmptyState } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";
import { groupByStage } from "@/lib/catalog";
import { KNOWN_COUNTRIES } from "@/lib/countries";
import { db } from "@/lib/db";
import { alternates } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; country: string }>;
}): Promise<Metadata> {
  const { locale, country: slug } = await params;
  const country = await db.country.findUnique({
    where: { code: slug.toUpperCase(), active: true },
    select: { nameAr: true, nameEn: true },
  });
  if (!country) return {};
  const name = pick(locale === "ar", country.nameAr, country.nameEn);
  return {
    title: name,
    description:
      locale === "ar"
        ? `صفوف ودورات ${name} على ذروة.`
        : `${name} grades and courses on Dhirwa.`,
    alternates: alternates(locale, `/courses/c/${slug.toLowerCase()}`),
  };
}

export default async function CountryPage({
  params,
}: {
  params: Promise<{ locale: string; country: string }>;
}) {
  const { locale, country: slug } = await params;
  setRequestLocale(locale);
  const code = slug.toUpperCase();
  const ar = locale === "ar";

  const [t, session, country] = await Promise.all([
    getTranslations("catalog"),
    auth(),
    db.country.findUnique({
      where: { code, active: true },
      include: {
        stages: { orderBy: { order: "asc" } },
        grades: {
          where: { active: true },
          orderBy: [{ order: "asc" }, { level: "asc" }],
          include: {
            _count: { select: { courses: { where: { published: true } } } },
          },
        },
      },
    }),
  ]);
  if (!country) notFound();

  const mine = session?.user
    ? (
        await db.user.findUnique({
          where: { id: session.user.id },
          select: { gradeId: true },
        })
      )?.gradeId
    : null;
  const numeral = new Intl.NumberFormat(ar ? "ar-EG-u-nu-latn" : "en");
  const name = pick(ar, country.nameAr, country.nameEn);
  // One tile per level; the URL has no curriculum segment, so the first curriculum wins.
  const grades = country.grades.filter(
    (g, i, all) => all.findIndex((x) => x.level === g.level) === i,
  );
  const groups = groupByStage(grades, country.stages);

  return (
    <main className="mx-auto grid max-w-(--container-page) gap-14 px-4 py-12 md:py-20">
      <Motion />
      <header className="grid gap-3">
        <p className="flex flex-wrap items-center gap-2 text-small text-ink-muted">
          <Link href="/courses" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
            {t("title")}
          </Link>
          <span aria-hidden="true" className="rtl:-scale-x-100">‹</span>
          {KNOWN_COUNTRIES.has(code) && (
            <Image src={`/flags/${slug.toLowerCase()}.svg`} alt="" width={20} height={15} className="rounded-[2px] ring-1 ring-hairline" />
          )}
          {name} · <span className="num">{country.currency}</span>
        </p>
        <h1 className="font-display text-display leading-[1.15] font-bold">{t.rich("pickGrade", { country: name, m: (c) => c })}</h1>
      </header>

      {groups.length === 0 && (
        <EmptyState>
          <p className="text-ink-muted">{t("noGrades")}</p>
        </EmptyState>
      )}
      {groups.map(({ stage, grades }) => (
        <section key={stage?.id ?? "other"} data-reveal="" className="grid gap-5">
          <h2 className="flex flex-wrap items-baseline gap-3">
            <span className="font-display text-h2 font-bold">{stage ? pick(ar, stage.nameAr, stage.nameEn) : t("otherGrades")}</span>
            {stage && (
              <span className="text-small text-ink-muted">
                {t("gradeRange", { from: numeral.format(stage.fromLevel), to: numeral.format(stage.toLevel) })}
              </span>
            )}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grades.map((g) => {
              const isMine = g.id === mine;
              const open = g._count.courses > 0;
              const body = (
                <>
                  <span className="flex items-start justify-between gap-3">
                    <span className="num font-display text-display leading-none font-bold">{numeral.format(g.level)}</span>
                    {isMine && (
                      <span className="flex items-center gap-1.5 text-label font-semibold">
                        <i aria-hidden="true" className="size-2 rounded-full bg-summit" />
                        {t("yourGrade")}
                      </span>
                    )}
                  </span>
                  {/* The big numeral already says "grade", so the tile drops the leading الصف. */}
                  <span className="font-medium">{pick(ar, g.nameAr.replace(/^الصف /, ""), g.nameEn)}</span>
                  <span className="flex flex-wrap items-center gap-x-3 text-small text-ink-muted">
                    {g.isTerminal && <span>{t("terminal")}</span>}
                    <span>{open ? t("available", { count: g._count.courses }) : t("comingSoon")}</span>
                  </span>
                </>
              );
              return (
                <li key={g.id}>
                  {open ? (
                    <Link href={`/courses/c/${slug.toLowerCase()}/${g.level}`} className="card hover-lift grid h-full content-start gap-2 p-6">
                      {body}
                    </Link>
                  ) : (
                    // A grade with no courses has nothing behind it; a link here is a dead end for a parent.
                    <div className="grid h-full content-start gap-2 rounded-lg border border-dashed border-rule p-6 text-ink-muted">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}
