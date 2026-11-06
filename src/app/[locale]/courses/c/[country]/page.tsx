import { pick } from "@/lib/content";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Landmark } from "@/components/brand/Landmark";
import { EmptyState } from "@/components/brand/Mark";
import { LineBadge } from "@/components/brand/Network";
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
        ? `صفوف وكورسات ${name} على ذروة.`
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
  const line = `var(--color-line-${code.toLowerCase()}, var(--color-ink))`;

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-10">
      <header className="card relative isolate flex items-center gap-4 overflow-hidden p-5 pb-12 sm:p-6 sm:pb-12">
        {/* The country's trail along the header's foot over two contour lines. Not mirrored: a map is never flipped. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 400 40"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 -z-10 h-10 w-full"
        >
          <g fill="none" strokeLinecap="round">
            <path d="M0 22C80 20 140 8 220 9S340 18 400 14" className="stroke-contour-4" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
            <path d="M0 30C80 28 150 17 230 18S340 26 400 23" className="stroke-contour-4" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
            <path d="M0 38C70 37 130 30 200 26S330 12 400 6" strokeWidth="3" vectorEffect="non-scaling-stroke" style={{ stroke: line }} />
          </g>
        </svg>
        <LineBadge code={code} className="size-16 text-h3" />
        <div className="grid flex-1 gap-1">
          <p className="flex items-center gap-2 text-small text-ink-muted">
            <Link
              href="/courses"
              className="inline-flex min-h-11 items-center text-pen underline-offset-4 hover:underline"
            >
              {t("title")}
            </Link>
            <span aria-hidden="true" className="rtl:-scale-x-100">
              ‹
            </span>
            {KNOWN_COUNTRIES.has(code) ? (
              <Image
                src={`/flags/${slug.toLowerCase()}.svg`}
                alt=""
                width={20}
                height={15}
                className="rounded-sm ring-1 ring-hairline"
              />
            ) : (
              <span className="rounded-sm px-1 text-label font-semibold ring-1 ring-hairline">
                {code}
              </span>
            )}
            {name} · <span className="num">{country.currency}</span>
          </p>
          <h1 className="font-display text-h1 font-bold">
            {t.rich("pickGrade", {
              country: name,
              m: (c) => <span className="marker">{c}</span>,
            })}
          </h1>
        </div>
        <span className="hidden sm:block">
          <Landmark code={code} size={88} />
        </span>
      </header>

      {groups.length === 0 && (
        <EmptyState>
          <p className="text-ink-muted">{t("noGrades")}</p>
        </EmptyState>
      )}
      {groups.map(({ stage, grades }) => (
        <section key={stage?.id ?? "other"} className="reveal grid gap-5">
          <h2 className="flex items-baseline gap-3">
            <span className="font-display text-h3 font-bold">
              {stage ? (pick(ar, stage.nameAr, stage.nameEn)) : t("otherGrades")}
            </span>
            {stage && (
              <span className="text-small text-ink-muted">
                {t("gradeRange", {
                  from: numeral.format(stage.fromLevel),
                  to: numeral.format(stage.toLevel),
                })}
              </span>
            )}
          </h2>
          {/* The stage as a stretch of the country's line: one station per grade, vertical on a phone, horizontal from sm up.
              A segment runs from each station to the next; it is solid only when both ends have courses, dashed otherwise
              (under construction), so the line itself tells which grades are open. */}
          <ol className="grid sm:auto-cols-fr sm:grid-flow-col">
            {grades.map((g, i) => {
              const isMine = g.id === mine;
              const open = g._count.courses > 0;
              const next = grades[i + 1];
              return (
                <li key={g.id} className="relative">
                  {next && (
                    <i
                      aria-hidden="true"
                      className={`absolute start-[calc(var(--spacing)*4-var(--line)/2)] top-[calc(var(--spacing)*6)] h-full border-s-(length:--line) sm:start-1/2 sm:top-[calc(var(--spacing)*4-var(--line)/2)] sm:h-0 sm:w-full sm:border-s-0 sm:border-t-(length:--line) ${
                        open && next._count.courses > 0 ? "" : "border-dashed"
                      }`}
                      style={{ borderColor: line }}
                    />
                  )}
                  {open ? (
                    <Link
                      href={`/courses/c/${slug.toLowerCase()}/${g.level}`}
                      aria-label={isMine ? `${pick(ar, g.nameAr, g.nameEn)}، ${t("yourGrade")}` : undefined}
                      className="group flex items-start gap-4 py-2 sm:grid sm:justify-items-center sm:gap-2 sm:px-1 sm:py-0 sm:text-center"
                    >
                    <span
                      aria-hidden="true"
                      className={`relative grid size-8 shrink-0 place-items-center rounded-full border-4 transition-colors duration-(--dur-fast) ease-(--ease-out) ${
                        isMine
                          ? "border-surface bg-marker shadow-glow"
                          : open
                            ? "border-primary bg-surface group-hover:bg-primary"
                            : "border-dashed border-field bg-surface group-hover:border-primary"
                      }`}
                    />
                    <span className="grid gap-0.5 sm:justify-items-center">
                      <span className="num font-display text-h2 leading-none font-bold">
                        {numeral.format(g.level)}
                      </span>
                      {/* The big numeral already says "grade", so the station drops the leading الصف. */}
                      <span className="text-small leading-snug font-medium">
                        {pick(ar, g.nameAr.replace(/^الصف /, ""), g.nameEn)}
                      </span>
                      {g.isTerminal && (
                        <span className="rounded-full bg-marker px-2 font-display text-label font-bold text-ink">
                          {t("terminal")}
                        </span>
                      )}
                      {isMine && (
                        <span className="text-label font-bold text-pen">
                          {t("yourGrade")}
                        </span>
                      )}
                      {open && (
                        <span className="text-label font-semibold text-pen">
                          {t("available", { count: g._count.courses })}
                        </span>
                      )}
                    </span>
                  
                    </Link>
                  ) : (
                    // A dashed station has nothing behind it; a link here is a dead end for a parent.
                    <div
                      aria-label={`${pick(ar, g.nameAr, g.nameEn)} · ${t("comingSoon")}`}
                      className="flex items-start gap-4 py-2 opacity-60 sm:grid sm:justify-items-center sm:gap-2 sm:px-1 sm:py-0 sm:text-center"
                    >
                    <span
                      aria-hidden="true"
                      className={`relative grid size-8 shrink-0 place-items-center rounded-full border-4 transition-colors duration-(--dur-fast) ease-(--ease-out) ${
                        isMine
                          ? "border-surface bg-marker shadow-glow"
                          : open
                            ? "border-primary bg-surface group-hover:bg-primary"
                            : "border-dashed border-field bg-surface group-hover:border-primary"
                      }`}
                    />
                    <span className="grid gap-0.5 sm:justify-items-center">
                      <span className="num font-display text-h2 leading-none font-bold">
                        {numeral.format(g.level)}
                      </span>
                      {/* The big numeral already says "grade", so the station drops the leading الصف. */}
                      <span className="text-small leading-snug font-medium">
                        {pick(ar, g.nameAr.replace(/^الصف /, ""), g.nameEn)}
                      </span>
                      {g.isTerminal && (
                        <span className="rounded-full bg-marker px-2 font-display text-label font-bold text-ink">
                          {t("terminal")}
                        </span>
                      )}
                      {isMine && (
                        <span className="text-label font-bold text-pen">
                          {t("yourGrade")}
                        </span>
                      )}
                      {open && (
                        <span className="text-label font-semibold text-pen">
                          {t("available", { count: g._count.courses })}
                        </span>
                      )}
                    </span>
                  
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </main>
  );
}
