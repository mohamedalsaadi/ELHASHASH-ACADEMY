import { pageMetadata } from "@/lib/seo";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Link } from "@/i18n/navigation";
import { opensAssignment } from "@/lib/assignments";
import { grantsFor } from "@/lib/catalog";
import { db } from "@/lib/db";
import { courseZone, formatDate } from "@/lib/format";
import { isLate, isOverdue } from "@/lib/grades";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/courses", "homework", { key: "title", noindex: true });
}

export default async function CourseAssignmentsPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/courses/${slug}/assignments`)}`);

  const t = await getTranslations("homework");
  const ar = locale === "ar";
  const now = new Date();

  const course = await db.course.findUnique({
    where: { slug, published: true },
    select: {
      id: true,
      titleAr: true,
      titleEn: true,
      grade: { select: { country: { select: { timeZone: true } } } },
      assignments: {
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          dueAt: true,
          maxScore: true,
          lesson: { select: { id: true, month: true, unit: { select: { term: true, isFree: true } } } },
          submissions: { where: { studentId: session.user.id }, select: { id: true, status: true, score: true, submittedAt: true } },
        },
      },
    },
  });
  if (!course) notFound();

  const grants = await grantsFor(session.user.id, course.id, now);
  const visible = course.assignments.filter((a) => opensAssignment({ courseId: course.id, lesson: a.lesson }, grants, now));

  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
      <PageHeader
        back={{ href: `/courses/${slug}`, label: ar ? course.titleAr : course.titleEn }}
        title={t("title")}
      />

      {visible.length === 0 ? (
        <p className="text-small text-ink-muted">{t("noAssignments")}</p>
      ) : (
        <ul className="grid gap-2">
          {visible.map((a) => {
            const sub = a.submissions[0];
            const late = sub ? isLate(sub.submittedAt, a.dueAt) : false;
            const overdue = isOverdue(!!sub, a.dueAt, now);
            return (
              <li key={a.id}>
                <Link
                  href={`/courses/${slug}/assignments/${a.id}`}
                  className="grid gap-1 rounded-md border border-hairline bg-surface p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display font-semibold" dir="auto">{a.title}</span>
                    {sub?.status === "GRADED" ? (
                      <StatusChip tone="active">{`${sub.score} / ${a.maxScore}`}</StatusChip>
                    ) : sub ? (
                      <StatusChip tone={sub.status === "RETURNED" ? "expiring" : "neutral"}>
                        {sub.status === "RETURNED" ? t("returned") : t("submitted")}
                      </StatusChip>
                    ) : overdue ? (
                      <StatusChip tone="expired">{t("overdue")}</StatusChip>
                    ) : (
                      <StatusChip tone="neutral">{t("notSubmitted")}</StatusChip>
                    )}
                  </span>
                  <span className="num text-label text-ink-muted">
                    {a.dueAt ? t("dueLabel", { date: formatDate(a.dueAt, courseZone(course), locale) }) : t("noDue")}
                    {late && ` · ${t("late")}`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
