import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { CourseCard } from "@/components/CourseCard";
import { Link } from "@/i18n/navigation";
import { cardInclude } from "@/lib/catalog";
import { db } from "@/lib/db";
import { alternates } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Params = { locale: string; country: string; level: string; subject: string };

// The same grade the grade page resolves: first by owner order, then curriculum.
function findGrade(code: string, level: number) {
  return db.grade.findFirst({
    where: { country: { code, active: true }, level, active: true },
    orderBy: [{ order: "asc" }, { curriculum: "asc" }],
    select: { id: true, nameAr: true, nameEn: true, country: { select: { nameAr: true, nameEn: true } } },
  });
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, country, level, subject: subjectSlug } = await params;
  const [grade, subject] = await Promise.all([
    findGrade(country.toUpperCase(), Number(level)),
    db.subject.findUnique({ where: { slug: subjectSlug, active: true }, select: { nameAr: true, nameEn: true } }),
  ]);
  if (!grade || !subject) return {};
  const ar = locale === "ar";
  const name = `${ar ? subject.nameAr : subject.nameEn} · ${ar ? grade.nameAr : grade.nameEn}`;
  return {
    title: name,
    description: ar ? `كورسات ${name} من مدرسيها على ذروة.` : `${name} courses from their teachers on Dhirwa.`,
    alternates: alternates(locale, `/courses/c/${country.toLowerCase()}/${level}/${subjectSlug}`),
  };
}

/** One subject in one grade: every published course its teachers have released, each with its own sessions and prices. */
export default async function SubjectPage({ params }: { params: Promise<Params> }) {
  const { locale, country: slug, level: raw, subject: subjectSlug } = await params;
  setRequestLocale(locale);
  const level = Number(raw);
  if (!Number.isInteger(level) || level < 1 || level > 12) notFound();
  const ar = locale === "ar";

  const [t, grade, subject] = await Promise.all([
    getTranslations("catalog"),
    findGrade(slug.toUpperCase(), level),
    db.subject.findUnique({ where: { slug: subjectSlug, active: true }, select: { id: true, nameAr: true, nameEn: true } }),
  ]);
  if (!grade || !subject) notFound();

  const courses = await db.course.findMany({
    where: { published: true, kind: "SCHOOL", gradeId: grade.id, subjectId: subject.id },
    orderBy: { createdAt: "desc" },
    include: cardInclude(new Date()),
  });
  const line = `var(--color-line-${slug.toLowerCase()}, var(--color-ink))`;
  const crumb = "inline-flex min-h-11 items-center text-pen underline-offset-4 hover:underline";

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-10">
      <header className="grid gap-1 border-b-(length:--line) pb-6" style={{ borderColor: line }}>
        <p className="flex flex-wrap items-center gap-x-2 text-small text-ink-muted">
          <Link href="/courses" className={crumb}>
            {t("title")}
          </Link>
          <span aria-hidden="true" className="rtl:-scale-x-100">‹</span>
          <Link href={`/courses/c/${slug.toLowerCase()}`} className={crumb}>
            {ar ? grade.country.nameAr : grade.country.nameEn}
          </Link>
          <span aria-hidden="true" className="rtl:-scale-x-100">‹</span>
          <Link href={`/courses/c/${slug.toLowerCase()}/${level}`} className={crumb}>
            {ar ? grade.nameAr : grade.nameEn}
          </Link>
        </p>
        <h1 className="font-display text-h1 font-bold">{ar ? subject.nameAr : subject.nameEn}</h1>
        <p className="max-w-[60ch] text-ink-muted">{t("subjectLede", { count: courses.length })}</p>
      </header>

      {courses.length === 0 ? (
        <EmptyState>
          <p className="text-ink-muted">{t("subjectEmpty")}</p>
        </EmptyState>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <li key={c.id}>
              <CourseCard course={c} locale={locale} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
