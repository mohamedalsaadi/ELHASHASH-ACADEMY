import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TeacherPhoto } from "@/components/TeacherPhoto";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function getTeacher(id: string) {
  return db.user.findFirst({
    where: { id, role: "INSTRUCTOR" },
    select: {
      name: true,
      photoUrl: true,
      bioAr: true,
      bioEn: true,
      courses: { where: { published: true }, orderBy: { slug: "asc" }, include: { grade: true, subject: true } },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher((await params).id);
  return { title: teacher?.name };
}

export default async function TeacherPublicPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const teacher = await getTeacher(id);
  if (!teacher) notFound();
  const t = await getTranslations("teacher");
  const ar = locale === "ar";
  const subjects = [...new Set(teacher.courses.map((c) => (ar ? c.subject.nameAr : c.subject.nameEn)))];
  const bio = ar ? teacher.bioAr || teacher.bioEn : teacher.bioEn || teacher.bioAr;

  return (
    <main className="mx-auto grid max-w-3xl gap-10 px-4 py-12">
      <section className="grid justify-items-center gap-4 text-center">
        <TeacherPhoto name={teacher.name} url={teacher.photoUrl} size={128} />
        <h1 className="font-display text-h1 font-semibold">{t("title", { name: teacher.name })}</h1>
        {subjects.length > 0 && (
          <ul className="flex flex-wrap justify-center gap-2">
            {subjects.map((s) => (
              <li key={s} className="rounded-full border border-hairline px-3 py-1 text-label text-ink-muted">
                {s}
              </li>
            ))}
          </ul>
        )}
        {bio && <p className="max-w-[60ch] whitespace-pre-line text-ink-muted">{bio}</p>}
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-semibold">{t("publicCourses", { count: teacher.courses.length })}</h2>
        <ul className="grid gap-2">
          {teacher.courses.map((c) => (
            <li key={c.id}>
              <Link
                href={`/courses/${c.slug}`}
                className="grid gap-1 rounded-md border border-hairline bg-surface p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
              >
                <span className="font-display font-semibold">{ar ? c.titleAr : c.titleEn}</span>
                <span className="text-small text-ink-muted">{ar ? c.grade.nameAr : c.grade.nameEn}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
