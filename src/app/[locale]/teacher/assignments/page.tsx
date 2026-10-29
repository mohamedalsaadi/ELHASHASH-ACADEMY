import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { courseZone, formatDate } from "@/lib/format";
import { requireStaff } from "@/lib/staff";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { TeacherNav } from "../TeacherNav";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/teacher/assignments", "homework", { key: "title", noindex: true });
}

export default async function TeacherAssignmentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireStaff();
  const t = await getTranslations("homework");
  const ar = locale === "ar";
  const now = new Date();

  const assignments = await db.assignment.findMany({
    where: me.role === "ADMIN" ? {} : { course: { instructorId: me.id } },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      title: true,
      dueAt: true,
      maxScore: true,
      course: {
        select: { slug: true, titleAr: true, titleEn: true, grade: { select: { country: { select: { timeZone: true } } } } },
      },
      lesson: { select: { titleAr: true, titleEn: true } },
      submissions: { select: { status: true, submittedAt: true } },
    },
  });

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-12">
      <PageHeader
        title={t("title")}
        actions={
          <Link href="/teacher/assignments/new" className="btn btn-primary">
            {t("new")}
          </Link>
        }
      />
      <TeacherNav current="assignments" />

      {assignments.length === 0 ? (
        <p className="text-small text-ink-muted">{t("noAssignments")}</p>
      ) : (
        <ul className="grid gap-2">
          {assignments.map((a) => {
            const graded = a.submissions.filter((s) => s.status === "GRADED").length;
            const late = a.dueAt ? a.submissions.filter((s) => s.submittedAt > a.dueAt!).length : 0;
            const waiting = a.submissions.filter((s) => s.status === "SUBMITTED").length;
            return (
              <li key={a.id}>
                <Link
                  href={`/teacher/assignments/${a.id}`}
                  className="grid gap-1 rounded-md border border-hairline bg-surface p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display font-semibold" dir="auto">{a.title}</span>
                    {a.dueAt && a.dueAt < now && waiting > 0 ? (
                      <StatusChip tone="expiring">{t("overdue")}</StatusChip>
                    ) : waiting > 0 ? (
                      <StatusChip tone="neutral">{`${t("waiting")}: ${waiting}`}</StatusChip>
                    ) : (
                      <StatusChip tone="active">{`${t("graded")}: ${graded}`}</StatusChip>
                    )}
                  </span>
                  <span className="text-small text-ink-muted">
                    {ar ? a.course.titleAr : a.course.titleEn}
                    {a.lesson && ` · ${ar ? a.lesson.titleAr : a.lesson.titleEn}`}
                  </span>
                  <span className="num text-label text-ink-muted">
                    {a.dueAt ? t("dueLabel", { date: formatDate(a.dueAt, courseZone(a.course), locale) }) : t("noDue")}
                    {late > 0 && ` · ${t("late")}: ${late}`}
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
