import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  const user = await db.user.findUnique({ where: { id }, select: { name: true } });
  if (!user) return {};
  return { title: user.name, robots: { index: true } };
}

const card = "grid gap-1 rounded-md border border-hairline bg-surface p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised";

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
      courses: {
        where: { published: true },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          slug: true,
          titleAr: true,
          titleEn: true,
          headlineAr: true,
          headlineEn: true,
          grade: { select: { nameAr: true, nameEn: true } },
          subject: { select: { nameAr: true, nameEn: true } },
        },
      },
    },
  });
  if (!user || (user.role !== "INSTRUCTOR" && user.role !== "ADMIN") || user.courses.length === 0) notFound();

  const bio = ar ? user.bioAr : user.bioEn;

  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-4 py-12">
      <header className="flex flex-wrap items-center gap-5">
        {user.photoUrl && (
          // Same-origin stream from the private store.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/avatars/${user.id}`} alt="" className="size-24 rounded-full object-cover" />
        )}
        <div className="grid gap-1">
          <h1 className="font-display text-h1 font-semibold">{user.name}</h1>
          {bio && (
            <p className="max-w-[60ch] text-small text-ink-muted" dir="auto">
              {bio}
            </p>
          )}
        </div>
      </header>

      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-semibold">{t("coursesTaught")}</h2>
        <ul className="grid gap-2">
          {user.courses.map((c) => (
            <li key={c.id}>
              <Link href={`/courses/${c.slug}`} className={card}>
                <span className="text-label text-ink-muted">
                  {ar ? c.subject?.nameAr : c.subject?.nameEn}
                  {c.grade && ` · ${ar ? c.grade.nameAr : c.grade.nameEn}`}
                </span>
                <span className="font-display text-h3 font-semibold">{ar ? c.titleAr : c.titleEn}</span>
                {(ar ? c.headlineAr : c.headlineEn) && (
                  <span className="text-small text-ink-muted">{ar ? c.headlineAr : c.headlineEn}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
