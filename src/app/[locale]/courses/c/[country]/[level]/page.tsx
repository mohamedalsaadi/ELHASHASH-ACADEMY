import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
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
    description: locale === "ar" ? `مواد ${name} وكورساتها على ذروة.` : `${name} subjects and courses on Dhirwa.`,
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
    // Every teacher's course of this subject lives on the subject page; the tile shows how many and the lowest price.
    const from = cheapestSku(courses.flatMap((c) => c.skus), now);
    return { subject, count: courses.length, from };
  });
  const live = tiles.filter((x) => x.count > 0).length;
  const card = "flex h-full min-h-44 flex-col gap-3 p-4";
  const line = `var(--color-line-${slug.toLowerCase()}, var(--color-ink))`;

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-10">
      <header className="grid gap-1 border-b-(length:--line) pb-6" style={{ borderColor: line }}>
        <p className="flex flex-wrap gap-2 text-small text-ink-muted">
          <Link href="/courses" className="inline-flex min-h-11 items-center text-pen underline-offset-4 hover:underline">
            {t("title")}
          </Link>
          <span aria-hidden="true" className="rtl:-scale-x-100">‹</span>
          <Link href={`/courses/c/${slug.toLowerCase()}`} className="inline-flex min-h-11 items-center text-pen underline-offset-4 hover:underline">
            {ar ? grade.country.nameAr : grade.country.nameEn}
          </Link>
          <span aria-hidden="true" className="rtl:-scale-x-100">‹</span>
          {ar ? grade.nameAr : grade.nameEn}
        </p>
        <h1 className="font-display text-h1 font-bold">{t.rich("pickSubject", { grade: ar ? grade.nameAr : grade.nameEn, m: (c) => <span className="marker">{c}</span> })}</h1>
        <p className="text-ink-muted">{t("subjectCount", { count: tiles.length, live })}</p>
      </header>

      <ul className="reveal grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.length === 0 && (
          <li className="col-span-full">
            <EmptyState>
              <p className="text-ink-muted">{t("noSubjects")}</p>
            </EmptyState>
          </li>
        )}
        {tiles.map(({ subject, count, from }) => {
          const label = (
            <span className="grid">
              <span className="font-display font-bold">{ar ? subject.nameAr : subject.nameEn}</span>
              <span className="text-label text-ink-muted" lang={ar ? "en" : "ar"}>
                {ar ? subject.nameEn : subject.nameAr}
              </span>
            </span>
          );
          return (
            <li key={subject.id}>
              {count > 0 ? (
                <Link
                  href={`/courses/c/${slug.toLowerCase()}/${level}/${subject.slug}`}
                  className={`${card} card border-t-(length:--line) bg-surface hover-lift`}
                  style={{ borderTopColor: line }}
                >
                  <SubjectIcon icon={subject.icon} size={44} />
                  {label}
                  <span className="mt-auto flex items-baseline justify-between gap-2 border-t border-dashed border-rule pt-2 text-small">
                    <span className="text-pen">{t("available", { count })}</span>
                    {from && <span className="num font-bold">{formatMoney(effectivePrice(from, now), from.currency, locale)}</span>}
                  </span>
                </Link>
              ) : (
                <div className={`${card} rounded-lg border-2 border-dashed border-field`}>
                  <SubjectIcon icon={subject.icon} size={44} muted />
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
