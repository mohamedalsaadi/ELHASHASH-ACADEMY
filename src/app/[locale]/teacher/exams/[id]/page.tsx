import { pick } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Block } from "@/components/homework/AttachmentList";
import { PageHeader } from "@/components/ui/PageHeader";
import { aiEnabled } from "@/lib/ai";
import { QuestionPages } from "@/components/QuestionPages";
import { StatusChip } from "@/components/ui/StatusChip";
import { db } from "@/lib/db";
import { assertCourse, requireStaff } from "@/lib/staff";
import { TeacherNav } from "../../TeacherNav";
import { askAiAboutAnswer, deleteExam, gradeWrittenForm, toggleExamItem, updateExam } from "../actions";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/teacher/exams", "exam", { key: "edit", noindex: true });
}

export default async function ExamManagePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const me = await requireStaff();
  const t = await getTranslations("exam");
  const tq = await getTranslations("practice");
  const ar = locale === "ar";

  const paper = await db.examPaper.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      durationMin: true,
      maxAttempts: true,
      published: true,
      courseId: true,
      course: { select: { slug: true, instructorId: true, titleAr: true, titleEn: true } },
      items: { orderBy: { order: "asc" }, select: { id: true, itemId: true } },
      attempts: {
        orderBy: { startedAt: "desc" },
        take: 50,
        select: {
          id: true,
          status: true,
          marks: true,
          maxMarks: true,
          user: { select: { name: true } },
          answers: { select: { id: true, itemId: true, correct: true, marks: true, text: true, aiMarks: true, aiFeedback: true, item: { select: { id: true, prompt: true, marks: true, kind: true, media: true } } } },
        },
      },
    },
  });
  if (!paper) notFound();
  await assertCourse(me, paper.courseId);

  const bank = await db.questionItem.findMany({
    where: { lesson: { unit: { courseId: paper.courseId } }, active: true },
    orderBy: [{ lessonId: "asc" }, { order: "asc" }],
    select: { id: true, prompt: true, kind: true, marks: true, lesson: { select: { titleAr: true, titleEn: true } } },
  });
  const chosen = new Set(paper.items.map((i) => i.itemId));
  // Share of marked answers that were right, per question, over the latest 50 attempts: a hard or broken question stands out.
  const stat = new Map<string, { n: number; ok: number }>();
  for (const a of paper.attempts)
    for (const ans of a.answers) {
      if (ans.correct === null) continue;
      const s = stat.get(ans.itemId) ?? { n: 0, ok: 0 };
      s.n += 1;
      if (ans.correct) s.ok += 1;
      stat.set(ans.itemId, s);
    }

  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 py-12">
      <PageHeader
        back={{ href: "/teacher/exams", label: t("title") }}
        eyebrow={pick(ar, paper.course.titleAr, paper.course.titleEn)}
        title={<span dir="auto">{paper.title}</span>}
      />
      <TeacherNav current="exams" />

      <Block title={t("edit")}>
        <form action={updateExam} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={paper.id} />
          <label className="grid gap-1 text-label text-ink-muted">
            {t("name")}
            <input name="title" defaultValue={paper.title} required maxLength={200} dir="auto" className="min-h-11 rounded-sm border border-field bg-surface px-3 text-body text-ink" />
          </label>
          <label className="grid gap-1 text-label text-ink-muted">
            {t("duration")}
            <input name="durationMin" type="number" min={5} max={300} defaultValue={paper.durationMin} dir="ltr" className="num min-h-11 w-28 rounded-sm border border-field bg-surface px-3 text-body text-ink" />
          </label>
          <label className="grid gap-1 text-label text-ink-muted">
            {t("attempts")}
            <input name="maxAttempts" type="number" min={1} max={10} defaultValue={paper.maxAttempts} dir="ltr" className="num min-h-11 w-24 rounded-sm border border-field bg-surface px-3 text-body text-ink" />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-label text-ink-muted">
            <input type="checkbox" name="published" defaultChecked={paper.published} className="size-4" />
            {t("publish")}
          </label>
          <button className="btn btn-outline px-4 py-2 text-small">{t("save")}</button>
        </form>
        <form action={deleteExam} className="border-t border-hairline pt-3">
          <input type="hidden" name="id" value={paper.id} />
          <button className="text-small font-semibold text-down underline underline-offset-4">{t("delete")}</button>
        </form>
      </Block>

      <Block title={`${t("questions")} (${paper.items.length})`}>
        {bank.length === 0 ? (
          <p className="text-small text-ink-muted">{tq("empty")}</p>
        ) : (
          <ul className="grid gap-1">
            {bank.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 rounded-sm border border-hairline px-2 py-1.5 text-small">
                <span className="min-w-0">
                  <span className="block truncate" dir="auto">{item.prompt || tq("pictureAlt")}</span>
                  <span className="text-label text-ink-muted">
                    {pick(ar, item.lesson.titleAr, item.lesson.titleEn)} · {item.kind} · <span className="num">{item.marks}</span>
                    {stat.get(item.id) && (
                      <span className="num"> · {Math.round((stat.get(item.id)!.ok / stat.get(item.id)!.n) * 100)}% ({stat.get(item.id)!.n})</span>
                    )}
                  </span>
                </span>
                <form action={toggleExamItem}>
                  <input type="hidden" name="paperId" value={paper.id} />
                  <input type="hidden" name="itemId" value={item.id} />
                  <button className={`shrink-0 rounded-full border px-3 py-1 text-label ${chosen.has(item.id) ? "border-pen text-pen" : "border-hairline text-ink-muted"}`}>
                    {chosen.has(item.id) ? "✓" : "+"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title={t("attempts")}>
        {paper.attempts.length === 0 ? (
          <p className="text-small text-ink-muted">{t("noExams")}</p>
        ) : (
          <ul className="grid gap-3">
            {paper.attempts.map((a) => {
              const written = a.answers.filter((x) => x.item.kind === "WRITTEN");
              return (
                <li key={a.id} className="grid gap-2 rounded-md border border-hairline p-3 text-small">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{a.user.name}</span>
                    <span className="flex items-center gap-2">
                      <StatusChip tone={a.status === "GRADED" ? "active" : a.status === "SUBMITTED" ? "expiring" : "neutral"}>
                        {a.status === "GRADED" ? t("graded") : a.status === "SUBMITTED" ? t("waiting") : t("start")}
                      </StatusChip>
                      <span className="num text-label text-ink-muted">
                        {a.marks ?? "—"} / {a.maxMarks}
                      </span>
                    </span>
                  </div>
                  {written.length > 0 && (
                    <ul className="grid gap-2">
                      {written.map((ans) => (
                        <li key={ans.id} className="grid gap-1 rounded-sm bg-raised p-2">
                          <span className="font-medium" dir="auto">{ans.item.prompt}</span>
                          <QuestionPages itemId={ans.item.id} count={ans.item.media.length} label={tq("pictureAlt")} />
                          <p className="whitespace-pre-line break-words" dir="auto">{ans.text}</p>
                          {ans.aiFeedback || ans.aiMarks !== null ? (
                            <div className="rounded-sm border border-hairline bg-surface p-2 text-label text-ink-muted">
                              <span className="font-semibold">{tq("aiSuggests")}{ans.aiMarks !== null && <span className="num"> {ans.aiMarks} / {ans.item.marks}</span>}</span>
                              {ans.aiFeedback && <p className="whitespace-pre-line" dir="auto">{ans.aiFeedback}</p>}
                              <span>{tq("aiNote")}</span>
                            </div>
                          ) : aiEnabled() ? (
                            <form action={askAiAboutAnswer}>
                              <input type="hidden" name="answerId" value={ans.id} />
                              <button className="text-label underline underline-offset-4">{tq("aiSuggests")}</button>
                            </form>
                          ) : null}
                          <form action={gradeWrittenForm} className="flex items-end gap-2">
                            <input type="hidden" name="answerId" value={ans.id} />
                            <label className="grid gap-1 text-label text-ink-muted">
                              {t("marks")} / {ans.item.marks}
                              <input name="marks" type="number" min={0} max={ans.item.marks} defaultValue={ans.marks ?? ans.aiMarks ?? ""} dir="ltr" className="num min-h-9 w-20 rounded-sm border border-field bg-surface px-2" />
                            </label>
                            <button className="btn btn-outline px-3 py-1.5 text-small">{t("grade")}</button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Block>

      <p className="text-small">
        <Link href={`/courses/${paper.course.slug}/exams`} className="text-pen underline underline-offset-4">
          {t("title")}
        </Link>
      </p>
    </main>
  );
}
