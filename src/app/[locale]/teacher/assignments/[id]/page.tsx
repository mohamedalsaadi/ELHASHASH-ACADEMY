import { pick } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { courseZone, formatDate } from "@/lib/format";
import { assertCourse, requireStaff } from "@/lib/staff";
import { AttachmentList, Block } from "@/components/homework/AttachmentList";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { TeacherNav } from "../../TeacherNav";
import { AssignmentForm } from "../AssignmentForm";
import { AiGradeForm } from "./AiGradeForm";
import { GradeForm } from "./GradeForm";
import { deleteAssignment, deleteAssignmentFile, toggleAssignmentItem, updateAssignment } from "../actions";
import { QuestionPages } from "@/components/QuestionPages";
import { scaleScore } from "@/lib/exams";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/teacher/assignments", "homework", { key: "edit", noindex: true });
}

export default async function AssignmentDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const me = await requireStaff();
  const t = await getTranslations("homework");
  const ar = locale === "ar";

  const assignment = await db.assignment.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      instructions: true,
      linkUrl: true,
      rubric: true,
      dueAt: true,
      maxScore: true,
      allowResubmit: true,
      courseId: true,
      course: {
        select: {
          slug: true,
          titleAr: true,
          titleEn: true,
          instructorId: true,
          grade: { select: { country: { select: { timeZone: true } } } },
        },
      },
      lesson: { select: { titleAr: true, titleEn: true } },
      items: { orderBy: { order: "asc" }, select: { itemId: true, item: { select: { marks: true } } } },
      files: { select: { id: true, downloadName: true, size: true } },
      submissions: {
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          status: true,
          text: true,
          submittedAt: true,
          revision: true,
          score: true,
          feedback: true,
          aiScore: true,
          aiFeedback: true,
          answers: { select: { id: true, itemId: true, text: true, choiceIds: true, correct: true, marks: true, aiMarks: true, aiFeedback: true, item: { select: { id: true, prompt: true, kind: true, marks: true, media: true, choices: { orderBy: { order: "asc" }, select: { id: true, label: true, correct: true } } } } } },
          student: { select: { id: true, name: true } },
          files: { select: { id: true, downloadName: true, size: true } },
        },
      },
    },
  });
  if (!assignment) notFound();
  await assertCourse(me, assignment.courseId);

  const courses = await db.course.findMany({
    where: me.role === "ADMIN" ? {} : { instructorId: me.id },
    orderBy: { slug: "asc" },
    select: { id: true, titleAr: true, titleEn: true, units: { orderBy: { order: "asc" }, select: { lessons: { orderBy: { order: "asc" }, select: { id: true, titleAr: true, titleEn: true } } } } },
  });
  const options = courses.map((c) => ({
    id: c.id,
    title: pick(ar, c.titleAr, c.titleEn),
    lessons: c.units.flatMap((u) => u.lessons).map((l) => ({ id: l.id, title: pick(ar, l.titleAr, l.titleEn) })),
  }));

  const tq = await getTranslations("practice");
  const bank = await db.questionItem.findMany({
    where: { lesson: { unit: { courseId: assignment.courseId } }, active: true },
    orderBy: [{ lessonId: "asc" }, { order: "asc" }],
    select: { id: true, prompt: true, kind: true, marks: true, lesson: { select: { titleAr: true, titleEn: true } } },
  });
  const chosen = new Set(assignment.items.map((i) => i.itemId));
  const totalMarks = assignment.items.reduce((sum, i) => sum + i.item.marks, 0);

  const waiting = assignment.submissions.filter((s) => s.status === "SUBMITTED").length;

  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 py-12">
      <PageHeader
        back={{ href: "/teacher/assignments", label: t("title") }}
        eyebrow={pick(ar, assignment.course.titleAr, assignment.course.titleEn)}
        title={<span dir="auto">{assignment.title}</span>}
        meta={
          <span className="num">
            {assignment.dueAt ? t("dueLabel", { date: formatDate(assignment.dueAt, courseZone(assignment.course), locale) }) : t("noDue")}
            {" · "}
            {t("maxScore")}: {assignment.maxScore}
            {waiting > 0 && ` · ${t("waiting")}: ${waiting}`}
          </span>
        }
      />
      <TeacherNav current="assignments" />

      <Block title={t("edit")}>
        <AssignmentForm
          mode="edit"
          action={updateAssignment}
          courses={options}
          values={{
            id: assignment.id,
            courseId: assignment.courseId,
            title: assignment.title,
            instructions: assignment.instructions,
            linkUrl: assignment.linkUrl,
            rubric: assignment.rubric,
            dueAt: assignment.dueAt ? assignment.dueAt.toISOString().slice(0, 16) : "",
            maxScore: assignment.maxScore,
            allowResubmit: assignment.allowResubmit,
          }}
          labels={{
            course: t("course"),
            lesson: t("lesson"),
            lessonNone: t("lessonNone"),
            title: t("name"),
            instructions: t("instructions"),
            linkUrl: t("linkUrl"),
            rubric: t("rubric"),
            due: t("due"),
            maxScore: t("maxScore"),
            allowResubmit: t("allowResubmit"),
            files: t("files"),
            attach: t("attach"),
            removeFile: t("removeFile"),
            uploadFailed: t("uploadFailed"),
            save: t("save"),
            invalid: t("invalid"),
          }}
        />
        <div className="grid gap-2 border-t border-hairline pt-3">
          <AttachmentList kind="assignment" files={assignment.files} empty={t("noFiles")} />
          {assignment.files.map((f) => (
            <form key={f.id} action={deleteAssignmentFile}>
              <input type="hidden" name="id" value={f.id} />
              <button className="text-label text-down underline underline-offset-4">
                {t("removeFile")}: <span dir="auto">{f.downloadName}</span>
              </button>
            </form>
          ))}
        </div>
        <form action={deleteAssignment} className="border-t border-hairline pt-3">
          <input type="hidden" name="id" value={assignment.id} />
          <button className="text-small font-semibold text-down underline underline-offset-4">{t("delete")}</button>
        </form>
      </Block>

      <Block title={`${t("questionsBlock")} (${assignment.items.length})`}>
        <p className="text-small text-ink-muted">{t("questionsHint")}</p>
        {bank.length === 0 ? (
          <p className="text-small text-ink-muted">{t("noBank")}</p>
        ) : (
          <ul className="grid gap-1">
            {bank.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 rounded-sm border border-hairline px-2 py-1.5 text-small">
                <span className="min-w-0">
                  <span className="block truncate" dir="auto">{item.prompt || tq("pictureAlt")}</span>
                  <span className="text-label text-ink-muted">
                    {pick(ar, item.lesson.titleAr, item.lesson.titleEn)} · {item.kind} · <span className="num">{item.marks}</span>
                  </span>
                </span>
                <form action={toggleAssignmentItem}>
                  <input type="hidden" name="assignmentId" value={assignment.id} />
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

      <Block title={t("submissions")}>
        {assignment.submissions.length === 0 ? (
          <p className="text-small text-ink-muted">{t("noSubmissions")}</p>
        ) : (
          <ul className="grid gap-4">
            {assignment.submissions.map((s) => (
              <li key={s.id} className="grid gap-2 rounded-md border border-hairline p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{s.student.name}</span>
                  <span className="flex items-center gap-2">
                    {s.status === "GRADED" && <StatusChip tone="active">{`${s.score} / ${assignment.maxScore}`}</StatusChip>}
                    {s.status === "SUBMITTED" && <StatusChip tone="neutral">{t("waiting")}</StatusChip>}
                    {s.status === "RETURNED" && <StatusChip tone="expiring">{t("returned")}</StatusChip>}
                    <span className="num text-label text-ink-muted">
                      {t("revision", { n: s.revision })} · {formatDate(s.submittedAt, courseZone(assignment.course), locale)}
                    </span>
                  </span>
                </div>
                {s.text && (
                  <p dir="auto" className="rounded-sm bg-raised p-3 text-small whitespace-pre-line break-words">
                    {s.text}
                  </p>
                )}
                <AttachmentList kind="submission" files={s.files} empty={t("noFiles")} />
                {s.answers.length > 0 && (
                  <ul className="grid gap-2">
                    {s.answers.map((ans) => (
                      <li key={ans.id} className="grid gap-1 rounded-sm bg-raised p-2 text-small">
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium" dir="auto">{ans.item.prompt || tq("pictureAlt")}</span>
                          <StatusChip tone={ans.correct === null ? "neutral" : ans.correct ? "active" : "expired"}>
                            {ans.correct === null ? t("waitingMark") : `${ans.marks ?? 0} / ${ans.item.marks}`}
                          </StatusChip>
                        </span>
                        <QuestionPages itemId={ans.item.id} count={ans.item.media.length} label={tq("pictureAlt")} />
                        {ans.text && <p className="whitespace-pre-line break-words" dir="auto">{ans.text}</p>}
                        {ans.choiceIds.length > 0 && (
                          <p className="text-ink-muted" dir="auto">{ans.item.choices.filter((c) => ans.choiceIds.includes(c.id)).map((c) => c.label).join(" · ")}</p>
                        )}
                        {(ans.aiMarks !== null || ans.aiFeedback) && (
                          <div className="rounded-sm border border-hairline bg-surface p-2 text-label text-ink-muted">
                            <span className="font-semibold">{tq("aiSuggests")}{ans.aiMarks !== null && <span className="num"> {ans.aiMarks} / {ans.item.marks}</span>}</span>
                            {ans.aiFeedback && <p className="whitespace-pre-line" dir="auto">{ans.aiFeedback}</p>}
                            <span>{tq("aiNote")}</span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {s.aiFeedback !== null && (
                  <p className="text-small text-pen" dir="auto">
                    {t("aiSuggestion", { score: s.aiScore ?? "—", max: assignment.maxScore })}
                    {s.aiFeedback ? ` · ${s.aiFeedback}` : ""}
                  </p>
                )}
                {(s.text || s.files.length > 0) && (
                  <AiGradeForm
                    id={s.id}
                    labels={{ aiGrade: t("aiGrade"), unavailable: t("aiUnavailable"), limited: t("aiLimited"), off: t("aiOff"), consent: t("aiConsent"), ok: t("aiOk"), invalid: t("invalid") }}
                  />
                )}
                <GradeForm
                  id={s.id}
                  maxScore={assignment.maxScore}
                  score={s.score ?? s.aiScore ?? (s.answers.length > 0 ? scaleScore(s.answers.reduce((sum, a) => sum + (a.marks ?? a.aiMarks ?? 0), 0), totalMarks, assignment.maxScore) : null)}
                  feedback={s.feedback}
                  labels={{
                    invalid: t("invalid"),
                    invalid_score: t("invalidScore", { max: assignment.maxScore }),
                    feedback_required: t("feedbackRequired"),
                    ok: t("gradedOk"),
                    score: t("score"),
                    feedback: t("feedback"),
                    saveGrade: t("saveGrade"),
                    returnToStudent: t("returnToStudent"),
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </Block>
    </main>
  );
}
