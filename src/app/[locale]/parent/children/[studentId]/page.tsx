import { pageMetadata } from "@/lib/seo";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { AttachmentList, Block } from "@/components/homework/AttachmentList";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { StatusChip } from "@/components/ui/StatusChip";
import { db } from "@/lib/db";
import { courseZone, formatDate } from "@/lib/format";
import { average, strengths, tierOf, type Score } from "@/lib/grades";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/parent", "homework", { key: "children", noindex: true });
}

export default async function ChildPage({ params }: { params: Promise<{ locale: string; studentId: string }> }) {
  const { locale, studentId } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/signin`);
  if (session.user.role !== "PARENT") redirect(`/${locale}/dashboard`);

  const link = await db.parentLink.findFirst({ where: { parentId: session.user.id, studentId }, select: { id: true } });
  if (!link) notFound();

  const t = await getTranslations("homework");
  const ar = locale === "ar";

  const student = await db.user.findUniqueOrThrow({ where: { id: studentId }, select: { name: true } });
  const submissions = await db.submission.findMany({
    where: { studentId },
    orderBy: { submittedAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      score: true,
      submittedAt: true,
      feedback: true,
      files: { select: { id: true, downloadName: true, size: true } },
      assignment: {
        select: {
          id: true,
          title: true,
          maxScore: true,
          dueAt: true,
          course: { select: { slug: true, titleAr: true, titleEn: true, grade: { select: { country: { select: { timeZone: true } } } } } },
          lesson: { select: { unit: { select: { id: true, titleAr: true, titleEn: true } } } },
        },
      },
    },
  });

  const scores: Score[] = submissions
    .filter((s) => s.status === "GRADED" && s.score !== null)
    .map((s) => ({ value: s.score!, max: s.assignment.maxScore, unitId: s.assignment.lesson?.unit.id ?? null }));
  const avg = average(scores);
  const unitNames = new Map(
    submissions.map((s) => [s.assignment.lesson?.unit.id, ar ? s.assignment.lesson?.unit.titleAr : s.assignment.lesson?.unit.titleEn] as const),
  );
  const shape = strengths(scores);

  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
      <PageHeader back={{ href: "/parent", label: t("children") }} title={student.name} />

      <div className="grid grid-cols-2 gap-2">
        <StatTile label={t("homeworkAverage")} value={avg ? `${avg.avg}%` : "—"} hint={avg ? t("sample", { n: avg.n }) : t("notEnough")} />
        <StatTile label={t("strengths")} value={shape ? `${shape.strongest.avg}%` : "—"} hint={shape ? (unitNames.get(shape.strongest.unitId) ?? t("notEnough")) : t("notEnough")} />
      </div>

      {shape && (
        <p className="text-small text-ink-muted">
          {t("strongest")}: {unitNames.get(shape.strongest.unitId)} · {t("weakest")}: {unitNames.get(shape.weakest.unitId)}
        </p>
      )}

      <Block title={t("title")}>
        {submissions.length === 0 ? (
          <p className="text-small text-ink-muted">{t("noSubmissions")}</p>
        ) : (
          <ul className="grid gap-3">
            {submissions.map((s) => (
              <li key={s.id} className="grid gap-1 rounded-md border border-hairline p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold" dir="auto">{s.assignment.title}</span>
                  {s.status === "GRADED" ? (
                    <StatusChip tone="active">{`${s.score} / ${s.assignment.maxScore} · ${Math.round((s.score! / s.assignment.maxScore) * 100)}%`}</StatusChip>
                  ) : s.status === "RETURNED" ? (
                    <StatusChip tone="expiring">{t("returned")}</StatusChip>
                  ) : (
                    <StatusChip tone="neutral">{t("submitted")}</StatusChip>
                  )}
                </div>
                <span className="text-label text-ink-muted">
                  {ar ? s.assignment.course.titleAr : s.assignment.course.titleEn}
                  {" · "}
                  <span className="num">
                    {formatDate(s.submittedAt, courseZone(s.assignment.course), locale)}
                  </span>
                  {s.status === "GRADED" && ` · ${t(`tier.${tierOf(Math.round((s.score! / s.assignment.maxScore) * 100))}`)}`}
                </span>
                {s.feedback && <p dir="auto" className="text-small whitespace-pre-line break-words">{s.feedback}</p>}
                <AttachmentList kind="submission" files={s.files} empty={t("noFiles")} />
              </li>
            ))}
          </ul>
        )}
      </Block>
    </main>
  );
}
