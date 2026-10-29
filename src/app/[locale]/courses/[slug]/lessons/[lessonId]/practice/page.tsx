import { pageMetadata } from "@/lib/seo";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { grantsFor } from "@/lib/catalog";
import { db } from "@/lib/db";
import { opensLesson } from "@/lib/plans";
import { PracticeForm } from "./PracticeForm";
import { submitPractice } from "./actions";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/courses", "practice", { key: "practice", noindex: true });
}

export default async function PracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string; lessonId: string }>;
  searchParams: Promise<{ attempt?: string }>;
}) {
  const { locale, slug, lessonId } = await params;
  const { attempt: attemptId } = await searchParams;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/courses/${slug}/lessons/${lessonId}/practice`)}`);

  const t = await getTranslations("practice");
  const ar = locale === "ar";
  const now = new Date();

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      month: true,
      titleAr: true,
      titleEn: true,
      unit: { select: { term: true, isFree: true, courseId: true, course: { select: { slug: true, titleAr: true, titleEn: true } } } },
      questionItems: {
        where: { active: true },
        orderBy: { order: "asc" },
        select: {
          id: true,
          kind: true,
          prompt: true,
          answer: true,
          explanation: true,
          marks: true,
          choices: { orderBy: { order: "asc" }, select: { id: true, label: true } },
        },
      },
    },
  });
  if (!lesson || lesson.unit.course.slug !== slug) notFound();

  const grants = await grantsFor(session.user.id, lesson.unit.courseId, now);
  const open = lesson.unit.isFree || grants.some((g) => opensLesson(g, { id: lesson.id, month: lesson.month, term: lesson.unit.term }, now));
  if (!open) redirect(`/${locale}/courses/${slug}#packages`);

  const attempt = attemptId
    ? await db.practiceAttempt.findFirst({
        where: { id: attemptId, userId: session.user.id },
        select: {
          id: true,
          marks: true,
          maxMarks: true,
          xp: true,
          answers: { select: { itemId: true, correct: true, choiceId: true, text: true } },
        },
      })
    : null;

  if (attempt) {
    const answered = new Map(attempt.answers.map((a) => [a.itemId, a]));
    return (
      <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
        <PageHeader
          back={{ href: `/courses/${slug}/lessons/${lesson.id}`, label: ar ? lesson.titleAr : lesson.titleEn }}
          title={t("result")}
          meta={
            <span className="num">
              {attempt.marks} / {attempt.maxMarks} · {t("xpEarned")}: {attempt.xp}
            </span>
          }
          actions={
            <Link href={`/courses/${slug}/lessons/${lesson.id}/practice`} className="btn btn-outline px-4 py-2 text-small">
              {t("retry")}
            </Link>
          }
        />

        <ul className="grid gap-3">
          {lesson.questionItems.map((item, i) => {
            const reply = answered.get(item.id);
            const correct = !!reply?.correct;
            const rightChoice = item.choices.find((c) => c.id === reply?.choiceId);
            return (
              <li key={item.id} className="grid gap-1 rounded-md border border-hairline bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="font-semibold" dir="auto">
                    <span className="num text-ink-muted">{i + 1}. </span>
                    {item.prompt}
                  </span>
                  <StatusChip tone={correct ? "active" : "expired"}>{correct ? t("correctLabel") : t("wrongLabel")}</StatusChip>
                </div>
                {item.kind === "SHORT" && reply?.text && (
                  <p className="text-small text-ink-muted" dir="auto">
                    {t("yourAnswer")}: {reply.text}
                  </p>
                )}
                {item.kind === "MCQ" && rightChoice && <p className="text-small text-ink-muted" dir="auto">{rightChoice.label}</p>}
                {!correct && item.answer && (
                  <p className="text-small text-up" dir="auto">
                    {t("rightAnswer", { answer: item.answer })}
                  </p>
                )}
                {item.explanation && (
                  <p className="text-small text-ink-muted" dir="auto">
                    {t("explanationLabel")}: {item.explanation}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </main>
    );
  }

  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
      <PageHeader
        back={{ href: `/courses/${slug}/lessons/${lesson.id}`, label: ar ? lesson.titleAr : lesson.titleEn }}
        title={t("practice")}
        meta={ar ? lesson.unit.course.titleAr : lesson.unit.course.titleEn}
      />
      {lesson.questionItems.length === 0 ? (
        <p className="text-small text-ink-muted">{t("none")}</p>
      ) : (
        <PracticeForm
          action={submitPractice}
          lessonId={lesson.id}
          items={lesson.questionItems.map((q) => ({ id: q.id, kind: q.kind, prompt: q.prompt, marks: q.marks, choices: q.choices }))}
          labels={{ submit: t("submit"), choose: t("choose"), yourAnswer: t("yourAnswer"), invalid: t("invalid"), closed: t("noAccess"), limited: t("limited") }}
        />
      )}
    </main>
  );
}
