import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Block } from "@/components/homework/AttachmentList";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/staff";
import { TeacherNav } from "../TeacherNav";
import { ExamCreateForm } from "./ExamCreateForm";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/teacher/exams", "exam", { key: "title", noindex: true });
}

export default async function TeacherExamsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireStaff();
  const t = await getTranslations("exam");
  const ar = locale === "ar";

  const courses = await db.course.findMany({
    where: me.role === "ADMIN" ? {} : { instructorId: me.id },
    orderBy: { slug: "asc" },
    select: { id: true, titleAr: true, titleEn: true },
  });
  const papers = await db.examPaper.findMany({
    where: { courseId: { in: courses.map((c) => c.id) } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      durationMin: true,
      published: true,
      course: { select: { titleAr: true, titleEn: true } },
      _count: { select: { items: true, attempts: true } },
    },
  });

  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 py-12">
      <PageHeader title={t("title")} />
      <TeacherNav current="exams" />

      {papers.length === 0 ? (
        <p className="text-small text-ink-muted">{t("noExams")}</p>
      ) : (
        <ul className="grid gap-2">
          {papers.map((p) => (
            <li key={p.id}>
              <Link
                href={`/teacher/exams/${p.id}`}
                className="grid gap-1 rounded-lg border border-hairline bg-surface shadow-paper p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-display font-semibold" dir="auto">{p.title}</span>
                  <StatusChip tone={p.published ? "active" : "neutral"}>{p.published ? t("publish") : t("edit")}</StatusChip>
                </span>
                <span className="text-small text-ink-muted">
                  {ar ? p.course.titleAr : p.course.titleEn}
                  {" · "}
                  <span className="num">{p._count.items}</span> {t("questions")}
                  {" · "}
                  <span className="num">{p.durationMin}</span>
                </span>
                <span className="num text-label text-ink-muted">
                  {t("attempts")}: {p._count.attempts}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {courses.length > 0 && (
        <Block title={t("new")}>
          <ExamCreateForm
            courses={courses.map((c) => ({ id: c.id, title: ar ? c.titleAr : c.titleEn }))}
            labels={{ name: t("name"), duration: t("duration"), create: t("create"), invalid: t("invalid") }}
          />
        </Block>
      )}
    </main>
  );
}
