import { cache } from "react";
import { Motion } from "@/components/motion/Motion";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CourseCard } from "@/components/CourseCard";
import { cardInclude } from "@/lib/catalog";
import { pick } from "@/lib/content";
import { db } from "@/lib/db";
import { courseRatings, teacherRating } from "@/lib/reviews";
import { alternates } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** generateMetadata and the page share one query per request instead of hitting the database twice. */
const getTeacher = cache((id: string) =>
  db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      role: true,
      bioAr: true,
      bioEn: true,
      photoUrl: true,
      yearsTeaching: true,
      qualification: true,
      courses: { where: { published: true }, orderBy: { createdAt: "desc" }, include: cardInclude(new Date()) },
    },
  }),
);

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const user = await getTeacher(id);
  if (!user) return {};
  return { title: user.name, robots: { index: true }, alternates: alternates(locale, `/teachers/${id}`) };
}

export default async function PublicTeacherPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("teacher");
  const ar = locale === "ar";

  const user = await getTeacher(id);
  if (!user || (user.role !== "INSTRUCTOR" && user.role !== "ADMIN") || user.courses.length === 0) notFound();

  // A bio written in one language only still shows on the other locale's page.
  const bio = pick(ar, user.bioAr, user.bioEn).trim();
  const [ratings, overall, reviews] = await Promise.all([
    courseRatings(user.courses.map((c) => c.id)),
    teacherRating(user.id),
    // Published written reviews only, newest first. No names: students are minors.
    db.courseReview.findMany({
      where: { status: "PUBLISHED", text: { not: null }, course: { instructorId: user.id } },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, stars: true, text: true, createdAt: true, course: { select: { titleAr: true, titleEn: true } }, student: { select: { grade: { select: { nameAr: true, nameEn: true } } } } },
    }),
  ]);
  const tr = await getTranslations("reviews");
  const subjects = [...new Set(user.courses.map((c) => pick(ar, c.subject?.nameAr, c.subject?.nameEn)).filter(Boolean))];

  return (
    <main className="mx-auto grid max-w-(--container-page) gap-14 px-4 py-12 md:py-20">
      <Motion />
      <header className="flex flex-wrap items-center gap-6">
        {user.photoUrl ? (
          // Same-origin stream from the private store.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/avatars/${user.id}`} alt="" className="size-28 rounded-full object-cover" />
        ) : (
          <span aria-hidden="true" className="grid size-28 place-items-center rounded-full bg-raised font-display text-h2 font-bold">
            {user.name.trim().charAt(0)}
          </span>
        )}
        <div className="grid gap-1">
          <h1 className="font-display text-display font-bold">{user.name}</h1>
          {subjects.length > 0 && <p className="text-lede font-medium">{subjects.join(" · ")}</p>}
          {overall && <p className="num text-lede font-semibold">{tr("teacherRating", { avg: String(overall.avg), count: String(overall.count) })}</p>}
          {(user.yearsTeaching || user.qualification) && (
            <p className="text-small text-ink-muted">
              {[user.yearsTeaching ? t("yearsTeachingValue", { years: user.yearsTeaching }) : null, user.qualification]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {bio && (
            <p className="max-w-[60ch] text-small text-ink-muted" dir="auto">
              {bio}
            </p>
          )}
        </div>
      </header>

      <section data-reveal="" className="grid gap-4">
        <h2 className="font-display text-h2 font-bold">{t("coursesTaught")}</h2>
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {user.courses.map((c) => (
            <li key={c.id}>
              <CourseCard course={c} locale={locale} rating={ratings.get(c.id)} />
            </li>
          ))}
        </ul>
      </section>

      {overall && reviews.length > 0 && (
        <section data-reveal="" className="grid gap-4">
          <h2 className="font-display text-h2 font-bold">{tr("teacherTitle")}</h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {reviews.map((r) => (
              <li key={r.id} className="card grid gap-2 p-5">
                <span className="num font-display text-h3 font-bold">{r.stars} / 5</span>
                <p dir="auto" className="whitespace-pre-line text-small">{r.text}</p>
                <span className="text-label text-ink-muted">
                  {tr("studentOf", { grade: pick(ar, r.student.grade?.nameAr, r.student.grade?.nameEn) || "-" })} · {pick(ar, r.course.titleAr, r.course.titleEn)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
