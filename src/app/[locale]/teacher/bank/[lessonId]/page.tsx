import { pick } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { assertCourse, requireStaff } from "@/lib/staff";
import { Block } from "@/components/homework/AttachmentList";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { TeacherNav } from "../../TeacherNav";
import { ImportForm } from "../ImportForm";
import { ItemForm } from "../ItemForm";
import { QuestionPages } from "@/components/QuestionPages";
import { deleteItem } from "../actions";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/teacher/bank", "practice", { key: "bank", noindex: true });
}

export default async function LessonBankPage({ params }: { params: Promise<{ locale: string; lessonId: string }> }) {
  const { locale, lessonId } = await params;
  setRequestLocale(locale);
  const me = await requireStaff();
  const t = await getTranslations("practice");
  const ar = locale === "ar";

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      titleAr: true,
      titleEn: true,
      unit: { select: { titleAr: true, titleEn: true, course: { select: { id: true, slug: true, instructorId: true, titleAr: true, titleEn: true } } } },
      questionItems: {
        orderBy: { order: "asc" },
        select: { id: true, kind: true, prompt: true, answer: true, explanation: true, marks: true, media: true, choices: { orderBy: { order: "asc" }, select: { id: true, label: true, correct: true } } },
      },
    },
  });
  if (!lesson) notFound();
  await assertCourse(me, lesson.unit.course.id);

  const formLabels = {
    addQuestion: t("addQuestion"), prompt: t("prompt"), kind: t("kind"), mcq: t("mcq"), multi: t("multi"), short: t("short"), written: t("written"),
    answer: t("answer"), explanation: t("explanation"), marks: t("marks"), save: t("save"), invalid: t("invalid"), saved: t("saved"),
    optionLetter: t("optionLetter"), tickCorrect: t("tickCorrect"), mediaPick: t("mediaPick"), mediaSending: t("mediaSending"),
    mediaFailed: t("mediaFailed"), mediaRemove: t("mediaRemove"), mediaPages: t("mediaPages"),
    trueFalse: t("trueFalse"), isTrue: t("isTrue"), isFalse: t("isFalse"), linkedLesson: t("linkedLesson"), noLesson: t("noLesson"),
  };

  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
      <PageHeader
        back={{ href: "/teacher/bank", label: t("bank") }}
        eyebrow={`${pick(ar, lesson.unit.course.titleAr, lesson.unit.course.titleEn)} · ${pick(ar, lesson.unit.titleAr, lesson.unit.titleEn)}`}
        title={<span dir="auto">{pick(ar, lesson.titleAr, lesson.titleEn)}</span>}
        actions={
          <Link href={`/courses/${lesson.unit.course.slug}/lessons/${lesson.id}/practice`} className="btn btn-outline px-4 py-2 text-small">
            {t("practice")}
          </Link>
        }
      />
      <TeacherNav current="bank" />

      <Block title={t("questions")}>
        {lesson.questionItems.length === 0 ? (
          <p className="text-small text-ink-muted">{t("empty")}</p>
        ) : (
          <ul className="grid gap-3">
            {lesson.questionItems.map((q, i) => (
              <li key={q.id} className="grid gap-1 rounded-md border border-hairline p-3 text-small">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold" dir="auto">
                    <span className="num text-ink-muted">{i + 1}. </span>
                    {q.prompt}
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusChip tone="neutral">{{ MCQ: t("mcq"), MULTI: t("multi"), SHORT: t("short"), WRITTEN: t("written") }[q.kind]}</StatusChip>
                    <span className="num text-label text-ink-muted">{q.marks}</span>
                  </span>
                </div>
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
                ) : (
                  <p className="text-ink-muted" dir="auto">
                    {t("answer")}: {q.answer}
                  </p>
                )}
                {q.explanation && (
                  <p className="text-label text-ink-muted" dir="auto">
                    {t("explanationLabel")}: {q.explanation}
                  </p>
                )}
                <div className="flex flex-wrap items-start gap-4">
                  <details className="w-full">
                    <summary className="w-fit cursor-pointer text-label underline underline-offset-4">{t("edit")}</summary>
                    <div className="mt-2">
                      <ItemForm lessonId={lesson.id} courseId={lesson.unit.course.id} labels={formLabels} item={q} />
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

      <Block title={t("addQuestion")}>
        <ItemForm lessonId={lesson.id} courseId={lesson.unit.course.id} labels={formLabels} />
      </Block>

      <Block title={t("importBtn")}>
        <ImportForm courseId={lesson.unit.course.id} lessonId={lesson.id} labels={{ importHint: t("importHint"), importBtn: t("importBtn"), invalid: t("importInvalid"), saved: t("saved") }} />
      </Block>
    </main>
  );
}
