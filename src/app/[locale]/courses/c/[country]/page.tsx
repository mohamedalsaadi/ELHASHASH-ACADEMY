import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Landmark } from "@/components/brand/Landmark";
import { CIRCLE_PATH } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { STAGES } from "@/lib/stages";

export const dynamic = "force-dynamic";

type Code = keyof typeof STAGES;

export default async function CountryPage({ params }: { params: Promise<{ locale: string; country: string }> }) {
  const { locale, country: slug } = await params;
  setRequestLocale(locale);
  const code = slug.toUpperCase() as Code;
  if (!(code in STAGES)) notFound();
  const ar = locale === "ar";

  const [t, session, country] = await Promise.all([
    getTranslations("catalog"),
    auth(),
    db.country.findUnique({
      where: { code },
      include: { grades: { orderBy: { level: "asc" }, include: { _count: { select: { courses: { where: { published: true } } } } } } },
    }),
  ]);
  if (!country) notFound();
  const mine = session?.user ? (await db.user.findUnique({ where: { id: session.user.id }, select: { gradeId: true } }))?.gradeId : null;
  const numeral = new Intl.NumberFormat(ar ? "ar-EG" : "en");
  const name = ar ? country.nameAr : country.nameEn;

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-10">
      <header className="flex items-center gap-4">
        <Landmark code={code} size={64} />
        <div className="grid gap-1">
          <p className="flex items-center gap-2 text-small text-ink-muted">
            <Link href="/courses" className="text-pen underline-offset-4 hover:underline">
              {t("title")}
            </Link>
            <span aria-hidden="true">‹</span>
            <Image src={`/flags/${slug.toLowerCase()}.svg`} alt="" width={20} height={15} className="rounded-[2px] ring-1 ring-hairline" />
            {name} · <span className="num">{country.currency}</span>
          </p>
          <h1 className="font-display text-h1 font-extrabold">{t.rich("pickGrade", { country: name, m: (c) => <span className="marker">{c}</span> })}</h1>
        </div>
      </header>

      {STAGES[code].map((stage) => (
        <section key={stage.from} className="grid gap-3">
          <h2 className="flex items-baseline gap-3">
            <span className="font-display text-h3 font-semibold">{ar ? stage.ar : stage.en}</span>
            <span className="text-small text-ink-muted">
              {t("gradeRange", { from: numeral.format(stage.from), to: numeral.format(stage.to) })}
            </span>
          </h2>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {country.grades
              .filter((g) => g.level >= stage.from && g.level <= stage.to)
              .map((g) => {
                const isMine = g.id === mine;
                return (
                  <li key={g.id}>
                    <Link
                      href={`/courses/c/${slug.toLowerCase()}/${g.level}`}
                      aria-label={isMine ? `${ar ? g.nameAr : g.nameEn}، ${t("yourGrade")}` : undefined}
                      className="flex h-36 flex-col justify-between rounded-md border-[1.5px] border-ink bg-surface p-3 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-marker"
                    >
                      <span className="flex items-start justify-between gap-1">
                        <span className="relative grid place-items-center">
                          {isMine && (
                            <svg viewBox="0 0 48 48" preserveAspectRatio="none" aria-hidden="true" className="absolute -inset-x-3 -inset-y-2 size-[calc(100%+1rem)] overflow-visible">
                              <path d={CIRCLE_PATH} fill="none" strokeWidth="2.2" strokeLinecap="round" className="stroke-pen" />
                            </svg>
                          )}
                          <span className="font-display text-[2.75rem] leading-none font-extrabold">{numeral.format(g.level)}</span>
                        </span>
                        {isMine && <span className="text-label font-semibold text-pen">{t("yourGrade")}</span>}
                      </span>
                      <span className="grid justify-items-start gap-0.5">
                        {g.isTerminal && <span className="rounded-full bg-marker px-2 font-display text-[.6875rem] font-semibold">{t("terminal")}</span>}
                        {/* The big numeral already says "grade", so the tile drops the leading الصف. */}
                        <span className="text-small leading-snug font-medium">{ar ? g.nameAr.replace(/^الصف /, "") : g.nameEn}</span>
                        {g._count.courses > 0 && <span className="text-label text-pen">{t("available", { count: g._count.courses })}</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </main>
  );
}
