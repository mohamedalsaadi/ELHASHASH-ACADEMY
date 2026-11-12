import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TeacherNav } from "@/app/[locale]/teacher/TeacherNav";
import { ImportForm } from "@/app/[locale]/teacher/bank/ImportForm";
import { ItemForm } from "@/app/[locale]/teacher/bank/ItemForm";
import { deleteItem } from "@/app/[locale]/teacher/bank/actions";
import { Block } from "@/components/homework/AttachmentList";
import { QuestionPages } from "@/components/QuestionPages";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/content";
import { db } from "@/lib/db";
import { pageMetadata } from "@/lib/seo";
import { assertCourse, requireStaff } from "@/lib/staff";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin/courses", "practice", { key: "workspaceTitle", noindex: true });
}

/**
 * The course's own place for questions, quizzes and exams, reached from the course page. A question belongs to the course;
 * linking it to a lesson is optional (a linked question also shows in that lesson's practice).
 */
export default async function CourseQuestionsPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const me = await requireStaff();
  await assertCourse(me, id);
  const t = await getTranslations("practice");
  const th = await getTranslations("homework");
  const te = await getTranslations("exam");
  const ar = locale === "ar";

  const course = await db.course.findUnique({
    where: { id },
    select: {
      id: true,
      titleAr: true,
      titleEn: true,
      units: { orderBy: { order: "asc" }, select: { titleAr: true, titleEn: true, lessons: { orderBy: { order: "asc" }, select: { id: true, titleAr: true, titleEn: true } } } },
      questionItems: {
        orderBy: [{ createdAt: "desc" }],
        take: 300,
        select: {
          id: true,
          kind: true,
          prompt: true,
          answer: true,
          explanation: true,
          marks: true,
          media: true,
          lessonId: true,
          lesson: { select: { titleAr: true, titleEn: true } },
          choices: { orderBy: { order: "asc" }, select: { id: true, label: true, correct: true } },
        },
      },
      assignments: { orderBy: { createdAt: "desc" }, take: 50, select: { id: true, title: true, kind: true, _count: { select: { items: true, submissions: true } } } },
      examPapers: { orderBy: { createdAt: "desc" }, take: 50, select: { id: true, title: true, published: true, _count: { select: { items: true } } } },
    },
  });
  if (!course) notFound();

  const lessons = course.units.flatMap((u) => u.lessons.map((l) => ({ id: l.id, title: `${pick(ar, u.titleAr, u.titleEn)} · ${pick(ar, l.titleAr, l.titleEn)}` })));
  const formLabels = {
    addQuestion: t("addQuestion"), prompt: t("prompt"), kind: t("kind"), mcq: t("mcq"), multi: t("multi"), short: t("short"), written: t("written"),
    answer: t("answer"), explanation: t("explanation"), marks: t("marks"), save: t("save"), invalid: t("invalid"), saved: t("saved"),
    optionLetter: t("optionLetter"), tickCorrect: t("tickCorrect"), mediaPick: t("mediaPick"), mediaSending: t("mediaSending"),
    mediaFailed: t("mediaFailed"), mediaRemove: t("mediaRemove"), mediaPages: t("mediaPages"),
    trueFalse: t("trueFalse"), isTrue: t("isTrue"), isFalse: t("isFalse"), linkedLesson: t("linkedLesson"), noLesson: t("noLesson"),
  };
  const kindLabel = { MCQ: t("mcq"), MULTI: t("multi"), SHORT: t("short"), WRITTEN: t("written") };

  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 py-12">
      <PageHeader
        back={{ href: `/admin/courses/${course.id}`, label: pick(ar, course.titleAr, course.titleEn) }}
        eyebrow={pick(ar, course.titleAr, course.titleEn)}
        title={t("workspaceTitle")}
        meta={t("questionCount", { count: course.questionItems.length })}
      />
      <TeacherNav current="courses" />
      <p className="text-small text-ink-muted">{t("workspaceIntro")}</p>

      <Block title={t("addQuestion")}>
        <ItemForm courseId={course.id} lessons={lessons} labels={formLabels} />
      </Block>

      <Block title={`${t("questionsOfCourse")} (${course.questionItems.length})`}>
        {course.questionItems.length === 0 ? (
          <p className="text-small text-ink-muted">{t("empty")}</p>
        ) : (
          <ul className="grid gap-3">
            {course.questionItems.map((q, i) => (
              <li key={q.id} className="grid gap-1 rounded-md border border-hairline p-3 text-small">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold" dir="auto">
                    <span className="num text-ink-muted">{i + 1}. </span>
                    {q.prompt || t("pictureAlt")}
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusChip tone="neutral">{kindLabel[q.kind]}</StatusChip>
                    <span className="num text-label text-ink-muted">{q.marks}</span>
                  </span>
                </div>
                <span className="text-label text-ink-muted">{q.lesson ? pick(ar, q.lesson.titleAr, q.lesson.titleEn) : t("courseOnly")}</span>
                <QuestionPages itemId={q.id} count={q.media.length} label={t("pictureAlt")} />
                {q.kind === "MCQ" || q.kind === "MULTI" ? (
                  <ul className="grid gap-0.5">
                    {q.choices.map((c, ci) => (
                      <li key={c.id} className={c.correct ? "font-semibold text-up" : "text-ink-muted"} dir="auto">
                        <span className="num" dir="ltr">{"ABCDEF"[ci]}. </span>
                        {c.label}
                      </li>
                    ))}
                  </ul>
                ) : q.answer ? (
                  <p className="text-ink-muted" dir="auto">{t("answer")}: {q.answer}</p>
                ) : null}
                <div className="flex flex-wrap items-start gap-4">
                  <details className="w-full">
                    <summary className="w-fit cursor-pointer text-label underline underline-offset-4">{t("edit")}</summary>
                    <div className="mt-2">
                      <ItemForm courseId={course.id} lessons={lessons} labels={formLabels} item={q} />
                    </div>
                  </details>
                  <form action={deleteItem}>
                    <input type="hidden" name="id" value={q.id} />
                    <button className="w-fit text-label text-down underline underline-offset-4">{t("delete")}</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title={t("importBtn")}>
        <ImportForm courseId={course.id} labels={{ importHint: t("importHint"), importBtn: t("importBtn"), invalid: t("importInvalid"), saved: t("saved") }} />
      </Block>

      <Block title={t("quizzesBlock")}>
        {course.assignments.length === 0 ? (
          <p className="text-small text-ink-muted">{t("noQuizzes")}</p>
        ) : (
          <ul className="grid gap-1">
            {course.assignments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 rounded-sm border border-hairline px-3 py-2 text-small">
                <span className="min-w-0">
                  <span className="block truncate" dir="auto">{a.title}</span>
                  <span className="text-label text-ink-muted">
                    {a.kind === "QUIZ" ? th("kindQuizChip") : th("kindHomework")} · <span className="num">{a._count.items}</span> {t("questionsShort")} · <span className="num">{a._count.submissions}</span> {th("submissions")}
                  </span>
                </span>
                <Link href={`/teacher/assignments/${a.id}`} className="btn btn-outline px-3 py-1.5 text-small">{t("manage")}</Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/teacher/assignments/new" className="btn btn-primary w-fit px-4 py-2 text-small">{t("newQuiz")}</Link>
      </Block>

      <Block title={t("examsBlock")}>
        {course.examPapers.length === 0 ? (
          <p className="text-small text-ink-muted">{t("noExams")}</p>
        ) : (
          <ul className="grid gap-1">
            {course.examPapers.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 rounded-sm border border-hairline px-3 py-2 text-small">
                <span className="min-w-0">
                  <span className="block truncate" dir="auto">{e.title}</span>
                  <span className="text-label text-ink-muted">
                    <span className="num">{e._count.items}</span> {t("questionsShort")} · {e.published ? te("publish") : "—"}
                  </span>
                </span>
                <Link href={`/teacher/exams/${e.id}`} className="btn btn-outline px-3 py-1.5 text-small">{t("manage")}</Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/teacher/exams" className="btn btn-outline w-fit px-4 py-2 text-small">{t("newExam")}</Link>
      </Block>
    </main>
  );
}
