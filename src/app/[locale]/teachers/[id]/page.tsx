import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CourseCard } from "@/components/CourseCard";
import { cardInclude } from "@/lib/catalog";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  const user = await db.user.findUnique({ where: { id }, select: { name: true } });
  if (!user) return {};
  return { title: user.name, robots: { index: true } };
}

export default async function PublicTeacherPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("teacher");
  const ar = locale === "ar";

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      role: true,
      bioAr: true,
      bioEn: true,
      photoUrl: true,
      courses: { where: { published: true }, orderBy: { createdAt: "desc" }, include: cardInclude(new Date()) },
    },
  });
  if (!user || (user.role !== "INSTRUCTOR" && user.role !== "ADMIN") || user.courses.length === 0) notFound();

  // A bio written in one language only still shows on the other locale's page.
  const bio = (ar ? user.bioAr || user.bioEn : user.bioEn || user.bioAr)?.trim();
  const subjects = [...new Set(user.courses.map((c) => (ar ? c.subject?.nameAr : c.subject?.nameEn)).filter(Boolean))];

  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-4 py-12">
      <header className="flex flex-wrap items-center gap-5 border-b-(length:--line) border-ink pb-6">
        {user.photoUrl ? (
          // Same-origin stream from the private store.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/avatars/${user.id}`} alt="" className="size-24 rounded-full border-4 border-ink object-cover" />
        ) : (
          <span aria-hidden="true" className="grid size-24 place-items-center rounded-full border-4 border-ink bg-raised font-display text-h2 font-extrabold">
            {user.name.trim().charAt(0)}
          </span>
        )}
        <div className="grid gap-1">
          <h1 className="font-display text-h1 font-extrabold">{user.name}</h1>
          {subjects.length > 0 && <p className="font-display font-semibold">{subjects.join(" · ")}</p>}
          {bio && (
            <p className="max-w-[60ch] text-small text-ink-muted" dir="auto">
              {bio}
            </p>
          )}
        </div>
      </header>

      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-extrabold">{t("coursesTaught")}</h2>
        <ul className="grid gap-5 sm:grid-cols-2">
          {user.courses.map((c) => (
            <li key={c.id}>
              <CourseCard course={c} locale={locale} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
