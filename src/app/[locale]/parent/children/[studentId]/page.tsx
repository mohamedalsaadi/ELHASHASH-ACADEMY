import { pick } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { AttachmentList, Block } from "@/components/homework/AttachmentList";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { StatusChip } from "@/components/ui/StatusChip";
import { Link } from "@/i18n/navigation";
import { isMinor } from "@/lib/age";
import { db } from "@/lib/db";
import { dbRole } from "@/lib/staff";
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
  if ((await dbRole(session.user.id)) !== "PARENT") redirect(`/${locale}/dashboard`);

  const link = await db.parentLink.findFirst({ where: { parentId: session.user.id, studentId }, select: { id: true } });
  if (!link) notFound();

  const t = await getTranslations("homework");
  const ar = locale === "ar";

  const student = await db.user.findUniqueOrThrow({ where: { id: studentId }, select: { name: true, dateOfBirth: true } });
  // For a child under 13 the parent watches the child's paid lessons from this account (one person at a time).
  const watch = isMinor(student.dateOfBirth)
    ? await db.entitlement.findMany({
        where: { userId: studentId, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }], lessonId: null, liveSessionId: null },
        distinct: ["courseId"],
        select: { course: { select: { slug: true, titleAr: true, titleEn: true, units: { orderBy: { order: "asc" }, take: 1, select: { lessons: { orderBy: { order: "asc" }, take: 1, select: { id: true } } } } } } },
      })
    : [];
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

  // Exams the child sat and the live classes they joined, newest first.
  const [exams, live] = await Promise.all([
    db.examAttempt.findMany({
      where: { userId: studentId, status: { in: ["SUBMITTED", "GRADED"] } },
      orderBy: { submittedAt: "desc" },
      take: 20,
      select: { id: true, status: true, marks: true, maxMarks: true, submittedAt: true, paper: { select: { title: true, course: { select: { titleAr: true, titleEn: true } } } } },
    }),
    db.liveAttendance.findMany({
      where: { userId: studentId },
      orderBy: { joinedAt: "desc" },
      take: 20,
      select: { joinedAt: true, liveSession: { select: { id: true, titleAr: true, titleEn: true } } },
    }),
  ]);

  const scores: Score[] = [
    ...submissions
      .filter((s) => s.status === "GRADED" && s.score !== null)
      .map((s) => ({ value: s.score!, max: s.assignment.maxScore, unitId: s.assignment.lesson?.unit.id ?? null })),
    // Exam papers are course-level, so they carry no unit — but they absolutely belong in the average.
    // Leaving them out made a child who sits exams look worse than their work says.
    ...exams
      .filter((e) => e.status === "GRADED" && e.marks !== null)
      .map((e) => ({ value: e.marks!, max: e.maxMarks, unitId: null })),
  ];
  const avg = average(scores);
  const unitNames = new Map(
    submissions.map((s) => [s.assignment.lesson?.unit.id, pick(ar, s.assignment.lesson?.unit.titleAr, s.assignment.lesson?.unit.titleEn)] as const),
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

      {watch.length > 0 && (
        <Block title={t("watchTitle")}>
          <p className="text-small text-ink-muted">{t("watchHint")}</p>
          <ul className="grid gap-2">
            {watch.map(({ course }) => {
              const first = course.units[0]?.lessons[0];
              return (
                <li key={course.slug}>
                  <Link href={first ? `/courses/${course.slug}/lessons/${first.id}` : `/courses/${course.slug}`} className="font-semibold text-pen underline-offset-4 hover:underline">
                    {pick(ar, course.titleAr, course.titleEn)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Block>
      )}

      <Block title={t("examsTitle")}>
        {exams.length === 0 ? (
          <p className="text-small text-ink-muted">{t("noExams")}</p>
        ) : (
          <ul className="grid gap-3">
            {exams.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-hairline p-3">
                <span className="grid">
                  <span className="font-semibold" dir="auto">{e.paper.title}</span>
                  <span className="text-label text-ink-muted">
                    {pick(ar, e.paper.course.titleAr, e.paper.course.titleEn)}
                    {e.submittedAt && (
                      <>
                        {" · "}
                        <span className="num">{formatDate(e.submittedAt, "Asia/Dubai", locale)}</span>
                      </>
                    )}
                  </span>
                </span>
                {e.status === "GRADED" && e.marks !== null ? (
                  <StatusChip tone="active">{`${e.marks} / ${e.maxMarks} · ${Math.round((e.marks / Math.max(e.maxMarks, 1)) * 100)}%`}</StatusChip>
                ) : (
                  <StatusChip tone="neutral">{t("awaitingMark")}</StatusChip>
                )}
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title={t("liveTitle")}>
        {live.length === 0 ? (
          <p className="text-small text-ink-muted">{t("noLive")}</p>
        ) : (
          <ul className="grid gap-2">
            {live.map((l) => (
              <li key={l.liveSession.id} className="flex flex-wrap justify-between gap-2 border-b border-hairline pb-2 last:border-0">
                <span>{pick(ar, l.liveSession.titleAr, l.liveSession.titleEn)}</span>
                <span className="num text-small text-ink-muted">{formatDate(l.joinedAt, "Asia/Dubai", locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </Block>

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
                  {pick(ar, s.assignment.course.titleAr, s.assignment.course.titleEn)}
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
