import { pageMetadata } from "@/lib/seo";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { db } from "@/lib/db";
import { startExam } from "../actions";
import { ExamForm } from "../ExamForm";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/courses", "exam", { key: "result", noindex: true });
}

export default async function ExamPage({ params }: { params: Promise<{ locale: string; slug: string; examId: string }> }) {
  const { locale, slug, examId } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/courses/${slug}/exams/${examId}`)}`);

  const t = await getTranslations("exam");
  const ar = locale === "ar";

  const paper = await db.examPaper.findUnique({
    where: { id: examId, published: true },
    select: {
      id: true,
      title: true,
      durationMin: true,
      maxAttempts: true,
      course: { select: { slug: true, titleAr: true, titleEn: true } },
      items: {
        orderBy: { order: "asc" },
        select: { item: { select: { id: true, kind: true, prompt: true, marks: true, answer: true, explanation: true, choices: { orderBy: { order: "asc" }, select: { id: true, label: true } } } } },
      },
      attempts: {
        where: { userId: session.user.id },
        orderBy: { startedAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          marks: true,
          maxMarks: true,
          expiresAt: true,
          answers: { select: { itemId: true, correct: true, marks: true, text: true, choice: { select: { label: true } } } },
        },
      },
    },
  });
  if (!paper || paper.course.slug !== slug) notFound();

  const used = await db.examAttempt.count({ where: { paperId: paper.id, userId: session.user.id } });
  const canRetake = used < paper.maxAttempts;
  const attempt = paper.attempts[0];
  const items = paper.items.map((i) => i.item);

  if (attempt?.status === "IN_PROGRESS") {
    return (
      <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
        <PageHeader
          back={{ href: `/courses/${slug}/exams`, label: t("title") }}
          eyebrow={ar ? paper.course.titleAr : paper.course.titleEn}
          title={<span dir="auto">{paper.title}</span>}
        />
        <ExamForm
          attemptId={attempt.id}
          expiresAt={attempt.expiresAt.toISOString()}
          items={items.map((q) => ({ id: q.id, kind: q.kind, prompt: q.prompt, marks: q.marks, choices: q.choices }))}
          labels={{
            submit: t("submit"),
            yourAnswer: t("written"),
            invalid: t("invalid"),
            closed: t("noAccess"),
            limited: t("invalid"),
            timeLeft: t("timeLeft"),
            timeUp: t("timeUp"),
          }}
        />
      </main>
    );
  }

  if (!attempt) {
    return (
      <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
        <PageHeader back={{ href: `/courses/${slug}/exams`, label: t("title") }} title={<span dir="auto">{paper.title}</span>} />
        <form action={startExam}>
          <input type="hidden" name="paperId" value={paper.id} />
          <button className="btn btn-primary px-4 py-2 text-small">{t("start")}</button>
        </form>
      </main>
    );
  }

  const answered = new Map(attempt.answers.map((a) => [a.itemId, a]));

  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
      <PageHeader
        back={{ href: `/courses/${slug}/exams`, label: t("title") }}
        eyebrow={ar ? paper.course.titleAr : paper.course.titleEn}
        title={<span dir="auto">{paper.title}</span>}
        meta={
          <span className="num inline-flex flex-wrap items-center gap-2">
            {attempt.marks ?? "—"} / {attempt.maxMarks} · {t("attemptsUsed", { used, max: paper.maxAttempts })}
            {/* The summit point: full marks on a graded paper. */}
            {attempt.status === "GRADED" && attempt.maxMarks > 0 && attempt.marks === attempt.maxMarks && (
              <span aria-hidden="true" className="size-2 rounded-full bg-summit" />
            )}
          </span>
        }
        actions={
          canRetake ? (
            <form action={startExam}>
              <input type="hidden" name="paperId" value={paper.id} />
              <button className="btn btn-outline px-4 py-2 text-small">{t("takeAgain")}</button>
            </form>
          ) : (
            <span className="text-small text-ink-muted">{t("noAttempts")}</span>
          )
        }
      />

      <StatusChip tone={attempt.status === "GRADED" ? "active" : "expiring"}>
        {attempt.status === "GRADED" ? t("graded") : t("waiting")}
      </StatusChip>

      <ul className="grid gap-3">
        {items.map((item, i) => {
          const ans = answered.get(item.id);
          const pending = item.kind === "WRITTEN" && (ans?.marks ?? null) === null;
          return (
            <li key={item.id} className="grid gap-1 card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="font-semibold" dir="auto">
                  <span className="num text-ink-muted">{i + 1}. </span>
                  {item.prompt}
                </span>
                <StatusChip tone={pending ? "neutral" : ans?.correct ? "active" : "expired"}>
                  {pending ? t("waiting") : `${ans?.marks ?? 0} / ${item.marks}`}
                </StatusChip>
              </div>
              {ans?.text && <p className="text-small text-ink-muted whitespace-pre-line break-words" dir="auto">{ans.text}</p>}
              {ans?.choice && <p className="text-small text-ink-muted" dir="auto">{ans.choice.label}</p>}
              {!pending && !ans?.correct && item.answer && (
                <p className="text-small text-up" dir="auto">{item.answer}</p>
              )}
              {item.explanation && !pending && <p className="text-small text-ink-muted" dir="auto">{item.explanation}</p>}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
