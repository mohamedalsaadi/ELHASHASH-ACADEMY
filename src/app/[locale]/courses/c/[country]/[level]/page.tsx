import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CIRCLE_PATH, EmptyState } from "@/components/brand/Mark";
import { SubjectIcon } from "@/components/brand/SubjectIcon";
import { Link } from "@/i18n/navigation";
import { cardInclude } from "@/lib/catalog";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { cheapestSku, effectivePrice } from "@/lib/pricing-engine";
import { alternates } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; country: string; level: string }> }): Promise<Metadata> {
  const { locale, country: slug, level: raw } = await params;
  const level = Number(raw);
  const grade = await db.grade.findFirst({
    where: { country: { code: slug.toUpperCase(), active: true }, level, active: true },
    orderBy: [{ order: "asc" }, { curriculum: "asc" }],
    select: { nameAr: true, nameEn: true },
  });
  if (!grade) return {};
  const name = locale === "ar" ? grade.nameAr : grade.nameEn;
  return {
    title: name,
    description: locale === "ar" ? `مواد ${name} وكورساتها على A+ Academy.` : `${name} subjects and courses on A+ Academy.`,
    alternates: alternates(locale, `/courses/c/${slug.toLowerCase()}/${level}`),
  };
}

export default async function GradePage({ params }: { params: Promise<{ locale: string; country: string; level: string }> }) {
  const { locale, country: slug, level: raw } = await params;
  setRequestLocale(locale);
  const code = slug.toUpperCase();
  const level = Number(raw);
  if (!Number.isInteger(level) || level < 1 || level > 12) notFound();
  const ar = locale === "ar";
  const now = new Date();

  const [t, grade] = await Promise.all([
    getTranslations("catalog"),
    db.grade.findFirst({
      where: { country: { code, active: true }, level, active: true },
      orderBy: [{ order: "asc" }, { curriculum: "asc" }],
      include: {
        country: true,
        subjects: { where: { subject: { active: true } }, orderBy: { order: "asc" }, include: { subject: true } },
        courses: {
          where: { published: true, kind: "SCHOOL", subject: { is: { active: true } } },
          orderBy: { createdAt: "asc" },
          include: { ...cardInclude(new Date()), subject: true },
        },
      },
    }),
  ]);
  if (!grade) notFound();

  // The owner's subject list first, then any active subject that has a course but isn't on the list yet.
  const listed = grade.subjects.map((s) => s.subject);
  const extra = grade.courses.flatMap((c) => (c.subject && c.subject.active && !listed.some((s) => s.id === c.subject!.id) ? [c.subject] : []));
  const tiles = [...listed, ...extra.filter((s, i) => extra.findIndex((x) => x.id === s.id) === i)].map((subject) => {
    const courses = grade.courses.filter((c) => c.subjectId === subject.id);
    // ponytail: two courses of one subject link to the oldest; a chooser page if teachers ever split a subject.
    const from = cheapestSku(courses.flatMap((c) => c.skus), now);
    return { subject, course: courses[0], from };
  });
  const live = tiles.filter((x) => x.course).length;
  const card = "flex h-full min-h-44 flex-col gap-3 rounded-lg p-4";

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-10">
      <header className="grid gap-1">
        <p className="flex flex-wrap gap-2 text-small text-ink-muted">
          <Link href="/courses" className="text-pen underline-offset-4 hover:underline">
            {t("title")}
          </Link>
          <span aria-hidden="true" className="rtl:-scale-x-100">‹</span>
          <Link href={`/courses/c/${slug.toLowerCase()}`} className="text-pen underline-offset-4 hover:underline">
            {ar ? grade.country.nameAr : grade.country.nameEn}
          </Link>
          <span aria-hidden="true" className="rtl:-scale-x-100">‹</span>
          {ar ? grade.nameAr : grade.nameEn}
        </p>
        <h1 className="font-display text-h1 font-extrabold">{t.rich("pickSubject", { grade: ar ? grade.nameAr : grade.nameEn, m: (c) => <span className="marker">{c}</span> })}</h1>
        <p className="text-ink-muted">{t("subjectCount", { count: tiles.length, live })}</p>
      </header>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.length === 0 && (
          <li className="col-span-full">
            <EmptyState>
              <p className="text-ink-muted">{t("noSubjects")}</p>
            </EmptyState>
          </li>
        )}
        {tiles.map(({ subject, course, from }) => {
          const label = (
            <span className="grid">
              <span className="font-display font-semibold">{ar ? subject.nameAr : subject.nameEn}</span>
              <span className="text-label text-ink-muted" lang={ar ? "en" : "ar"}>
                {ar ? subject.nameEn : subject.nameAr}
              </span>
            </span>
          );
          return (
            <li key={subject.id}>
              {course ? (
                <Link
                  href={`/courses/${course.slug}`}
                  className={`${card} border border-hairline bg-surface shadow-paper hover-lift`}
                >
                  <SubjectIcon icon={subject.icon} size={44} />
                  {label}
                  <span className="mt-auto flex items-baseline justify-between gap-2 border-t border-dashed border-rule pt-2 text-small">
                    {from ? (
                      <>
                        <span className="text-ink-muted">{t("from")}</span>
                        <span className="num font-semibold">{formatMoney(effectivePrice(from, now), from.currency, locale)}</span>
                      </>
                    ) : (
                      <span className="text-pen">{t("freeUnit")}</span>
                    )}
                  </span>
                </Link>
              ) : (
                <div className={`${card} border border-dashed border-field`}>
                  <span className="relative grid size-12 place-items-center">
                    <svg viewBox="0 0 48 48" aria-hidden="true" className="absolute inset-0">
                      <path d={CIRCLE_PATH} fill="none" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 4" className="stroke-field" />
                    </svg>
                    <SubjectIcon icon={subject.icon} size={30} muted />
                  </span>
                  {label}
                  <span className="mt-auto border-t border-dashed border-rule pt-2 text-small text-ink-muted">{t("soon")}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
