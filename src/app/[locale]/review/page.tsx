import { pick } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { PracticeForm } from "../courses/[slug]/lessons/[lessonId]/practice/PracticeForm";
import { db } from "@/lib/db";
import { dueNow } from "@/lib/review";
import { submitReview } from "./actions";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/review", "practice", { key: "reviewTitle", noindex: true });
}

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ attempts?: string }>;
}) {
  const { locale } = await params;
  const { attempts: attemptIds } = await searchParams;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/review`)}`);
  if (session.user.role !== "STUDENT") redirect(`/${locale}/dashboard`);

  const t = await getTranslations("practice");
  const ar = locale === "ar";
  const now = new Date();

  if (attemptIds) {
    const ids = attemptIds.split(",").slice(0, 10);
    const attempts = await db.practiceAttempt.findMany({
      where: { id: { in: ids }, userId: session.user.id },
      select: {
        id: true,
        marks: true,
        maxMarks: true,
        xp: true,
        lesson: { select: { titleAr: true, titleEn: true } },
        answers: {
          orderBy: { id: "asc" },
          select: {
            correct: true,
            text: true,
            item: { select: { prompt: true, answer: true, explanation: true, kind: true } },
            choice: { select: { label: true } },
          },
        },
      },
    });
    const xp = attempts.reduce((sum, a) => sum + a.xp, 0);
    const marks = attempts.reduce((sum, a) => sum + a.marks, 0);
    const maxMarks = attempts.reduce((sum, a) => sum + a.maxMarks, 0);

    return (
      <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
        <PageHeader
          back={{ href: "/dashboard", label: t("reviewTitle") }}
          title={t("result")}
          meta={
            <span className="num">
              {marks} / {maxMarks} · {t("xpEarned")}: {xp}
            </span>
          }
          actions={
            <Link href="/review" className="btn btn-outline px-4 py-2 text-small">
              {t("retry")}
            </Link>
          }
        />
        <ul className="grid gap-3">
          {attempts.flatMap((a) =>
            a.answers.map((ans, i) => (
              <li key={`${a.id}-${i}`} className="grid gap-1 card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="font-semibold" dir="auto">{ans.item.prompt}</span>
                  <StatusChip tone={ans.correct ? "active" : "expired"}>{ans.correct ? t("correctLabel") : t("wrongLabel")}</StatusChip>
                </div>
                <span className="text-label text-ink-muted">{pick(ar, a.lesson.titleAr, a.lesson.titleEn)}</span>
                {ans.text && <p className="text-small text-ink-muted" dir="auto">{t("yourAnswer")}: {ans.text}</p>}
                {ans.choice && <p className="text-small text-ink-muted" dir="auto">{ans.choice.label}</p>}
                {!ans.correct && ans.item.answer && (
                  <p className="text-small text-up" dir="auto">{t("rightAnswer", { answer: ans.item.answer })}</p>
                )}
                {ans.item.explanation && (
                  <p className="text-small text-ink-muted" dir="auto">{t("explanationLabel")}: {ans.item.explanation}</p>
                )}
              </li>
            )),
          )}
        </ul>
      </main>
    );
  }

  const schedules = await db.reviewSchedule.findMany({
    where: { userId: session.user.id, dueAt: { lte: now } },
    orderBy: { dueAt: "asc" },
    take: 20,
    select: { lessonId: true, dueAt: true },
  });
  const due = dueNow(schedules, now, 5);
  const items = due.length
    ? await db.questionItem.findMany({
        where: { lessonId: { in: due.map((d) => d.lessonId) }, active: true, kind: { in: ["MCQ", "SHORT"] } },
        orderBy: [{ lessonId: "asc" }, { order: "asc" }],
        take: 10,
        select: { id: true, kind: true, prompt: true, marks: true, choices: { orderBy: { order: "asc" }, select: { id: true, label: true } } },
      })
    : [];

  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
      <PageHeader
        back={{ href: "/dashboard", label: t("reviewTitle") }}
        title={t("reviewTitle")}
        meta={due.length > 0 ? t("reviewDue", { count: due.length }) : t("reviewNone")}
      />
      {items.length === 0 ? (
        <p className="text-small text-ink-muted">{t("reviewNone")}</p>
      ) : (
        <PracticeForm
          action={submitReview}
          items={items}
          labels={{ submit: t("submit"), choose: t("choose"), yourAnswer: t("yourAnswer"), invalid: t("invalid"), closed: t("noAccess"), limited: t("limited") }}
        />
      )}
    </main>
  );
}
