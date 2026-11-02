import { pageMetadata } from "@/lib/seo";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { db } from "@/lib/db";
import { startExam } from "./actions";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/courses", "exam", { key: "title", noindex: true });
}

export default async function CourseExamsPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/courses/${slug}/exams`)}`);

  const t = await getTranslations("exam");
  const ar = locale === "ar";

  const course = await db.course.findUnique({
    where: { slug, published: true },
    select: {
      id: true,
      titleAr: true,
      titleEn: true,
      examPapers: {
        where: { published: true },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          durationMin: true,
          maxAttempts: true,
          _count: { select: { items: true, attempts: { where: { userId: session.user.id } } } },
          attempts: {
            where: { userId: session.user.id },
            orderBy: { startedAt: "desc" },
            take: 1,
            select: { id: true, status: true, marks: true, maxMarks: true },
          },
        },
      },
    },
  });
  if (!course) notFound();

  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
      <PageHeader back={{ href: `/courses/${slug}`, label: ar ? course.titleAr : course.titleEn }} title={t("title")} />

      {course.examPapers.length === 0 ? (
        <p className="text-small text-ink-muted">{t("noExams")}</p>
      ) : (
        <ul className="grid gap-2">
          {course.examPapers.map((p) => {
            const last = p.attempts[0];
            return (
              <li key={p.id} className="grid gap-2 card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-display font-semibold" dir="auto">{p.title}</span>
                  {last?.status === "GRADED" ? (
                    <StatusChip tone="active">{`${last.marks ?? 0} / ${last.maxMarks}`}</StatusChip>
                  ) : last?.status === "SUBMITTED" ? (
                    <StatusChip tone="expiring">{t("waiting")}</StatusChip>
                  ) : last?.status === "IN_PROGRESS" ? (
                    <StatusChip tone="neutral">{t("resume")}</StatusChip>
                  ) : (
                    <StatusChip tone="neutral">{t("start")}</StatusChip>
                  )}
                </div>
                <span className="text-small text-ink-muted">
                  <span className="num">{p._count.items}</span> {t("questions")} · <span className="num">{p.durationMin}</span>
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {last?.status === "IN_PROGRESS" || p._count.attempts < p.maxAttempts ? (
                    <form action={startExam}>
                      <input type="hidden" name="paperId" value={p.id} />
                      <button className="btn btn-primary px-4 py-2 text-small">{last?.status === "IN_PROGRESS" ? t("resume") : t("start")}</button>
                    </form>
                  ) : (
                    <span className="text-small text-ink-muted">{t("noAttempts")}</span>
                  )}
                  <Link href={`/courses/${slug}/exams/${p.id}`} className="btn btn-outline px-4 py-2 text-small">
                    {t("result")}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
