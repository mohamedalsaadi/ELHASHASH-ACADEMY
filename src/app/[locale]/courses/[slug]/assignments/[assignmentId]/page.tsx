import { pick } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { AttachmentList, Block } from "@/components/homework/AttachmentList";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { opensAssignment } from "@/lib/assignments";
import { grantsFor } from "@/lib/catalog";
import { db } from "@/lib/db";
import { courseZone, formatDate } from "@/lib/format";
import { isLate } from "@/lib/grades";
import { SubmitForm } from "../SubmitForm";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/courses", "homework", { key: "title", noindex: true });
}

export default async function AssignmentPage({ params }: { params: Promise<{ locale: string; slug: string; assignmentId: string }> }) {
  const { locale, slug, assignmentId } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) {
    redirect(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/courses/${slug}/assignments/${assignmentId}`)}`);
  }

  const t = await getTranslations("homework");
  const ar = locale === "ar";
  const now = new Date();

  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      title: true,
      instructions: true,
      linkUrl: true,
      dueAt: true,
      maxScore: true,
      allowResubmit: true,
      courseId: true,
      course: {
        select: {
          slug: true,
          titleAr: true,
          titleEn: true,
          grade: { select: { country: { select: { timeZone: true } } } },
        },
      },
      lesson: { select: { id: true, month: true, titleAr: true, titleEn: true, unit: { select: { term: true, isFree: true } } } },
      files: { select: { id: true, downloadName: true, size: true } },
      items: { orderBy: { order: "asc" }, select: { item: { select: { id: true, kind: true, prompt: true, marks: true, media: true, choices: { orderBy: { order: "asc" }, select: { id: true, label: true } } } } } },
      submissions: {
        where: { studentId: session.user.id },
        select: {
          id: true,
          status: true,
          text: true,
          submittedAt: true,
          revision: true,
          score: true,
          feedback: true,
          answers: { select: { itemId: true, text: true, choiceIds: true, correct: true, marks: true } },
          files: { select: { id: true, downloadName: true, size: true } },
        },
      },
    },
  });
  if (!assignment || assignment.course.slug !== slug) notFound();

  const grants = await grantsFor(session.user.id, assignment.courseId, now);
  const open = opensAssignment(assignment, grants, now);
  const sub = assignment.submissions[0];

  // Nothing earned and nothing open: this is a sales page, not a homework page.
  if (!open && !sub) redirect(`/${locale}/courses/${slug}#packages`);

  const canSubmit = open && (!sub || (assignment.allowResubmit && (sub.status === "GRADED" || sub.status === "RETURNED")));
  const zone = courseZone(assignment.course);
  const tp = await getTranslations("practice");
  const questions = assignment.items.map((i) => ({ ...i.item, mediaCount: i.item.media.length }));
  const answerOf = new Map((sub?.answers ?? []).map((a) => [a.itemId, a]));

  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
      <PageHeader
        back={{ href: `/courses/${slug}/assignments`, label: t("title") }}
        eyebrow={pick(ar, assignment.course.titleAr, assignment.course.titleEn)}
        title={<span dir="auto">{assignment.title}</span>}
        meta={
          <span className="num">
            {assignment.dueAt ? t("dueLabel", { date: formatDate(assignment.dueAt, zone, locale) }) : t("noDue")}
            {" · "}
            {t("maxScore")}: {assignment.maxScore}
          </span>
        }
      />

      {assignment.instructions && (
        <p dir="auto" className="text-ink-muted whitespace-pre-line break-words">
          {assignment.instructions}
        </p>
      )}

      {/* Only while the assignment is open to this student, and through the gate: the raw address is never in the page. */}
      {assignment.linkUrl && open && (
        <a href={`/api/out/${assignment.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline w-fit">
          {t("openLink")}
        </a>
      )}

      <Block title={t("files")}>
        <AttachmentList kind="assignment" files={assignment.files} empty={t("noFiles")} />
      </Block>

      {sub && (
        <Block title={t("yourAnswer")}>
          <div className="flex flex-wrap items-center gap-2">
            {sub.status === "GRADED" ? (
              <StatusChip tone="active">{`${sub.score} / ${assignment.maxScore}`}</StatusChip>
            ) : sub.status === "RETURNED" ? (
              <StatusChip tone="expiring">{t("returned")}</StatusChip>
            ) : (
              <StatusChip tone="neutral">{t("submitted")}</StatusChip>
            )}
            <span className="num text-label text-ink-muted">
              {t("submittedAt", { date: formatDate(sub.submittedAt, zone, locale) })}
              {isLate(sub.submittedAt, assignment.dueAt) && ` · ${t("late")}`}
              {` · ${t("revision", { n: sub.revision })}`}
            </span>
          </div>
          {questions.length > 0 && (
            <ul className="grid gap-2">
              {questions.map((q, qi) => {
                const a = answerOf.get(q.id);
                return (
                  <li key={q.id} className="grid gap-1 rounded-sm bg-raised p-3 text-small">
                    <span className="flex flex-wrap items-start justify-between gap-2">
                      <span className="font-semibold" dir="auto"><span className="num text-ink-muted">{qi + 1}. </span>{q.prompt}</span>
                      {a && <StatusChip tone={a.correct === null ? "neutral" : a.correct ? "active" : "expired"}>{a.correct === null ? t("waitingMark") : `${a.marks ?? 0} / ${q.marks}`}</StatusChip>}
                    </span>
                    {a?.text && <p className="text-ink-muted whitespace-pre-line break-words" dir="auto">{a.text}</p>}
                    {a && a.choiceIds.length > 0 && <p className="text-ink-muted" dir="auto">{q.choices.filter((c) => a.choiceIds.includes(c.id)).map((c) => c.label).join(" · ")}</p>}
                  </li>
                );
              })}
            </ul>
          )}
          {sub.text && (
            <p dir="auto" className="rounded-sm bg-raised p-3 text-small whitespace-pre-line break-words">
              {sub.text}
            </p>
          )}
          <AttachmentList kind="submission" files={sub.files} empty={t("noFiles")} />
          {sub.feedback && (
            <div className="grid gap-1 border-s-2 border-pen ps-3">
              <span className="text-label font-semibold text-pen">{t("feedback")}</span>
              <p dir="auto" className="text-small whitespace-pre-line break-words">{sub.feedback}</p>
            </div>
          )}
        </Block>
      )}

      {canSubmit ? (
        <Block title={sub ? t("resubmit") : t("submit")}>
          <SubmitForm
            assignmentId={assignment.id}
            studentId={session.user.id}
            items={questions}
            labels={{
              yourAnswer: tp("yourAnswer"),
              pictureAlt: tp("pictureAlt"),
              pickAll: tp("pickAll"),
              extra: t("optionalExtra"),
              invalid: t("emptyAnswer"),
              closed: t("noAccess"),
              already: t("alreadySubmitted"),
              limited: t("limited"),
              ok: t("submitOk"),
              masked: t("masked"),
              filesLost: t("filesLost"),
              answer: t("yourAnswer"),
              hint: t("answerHint"),
              submit: sub ? t("resubmit") : t("submit"),
              attach: t("attach"),
              removeFile: t("removeFile"),
              uploadFailed: t("uploadFailed"),
            }}
          />
        </Block>
      ) : (
        !open && <p className="text-small text-ink-muted">{t("noAccess")}</p>
      )}
    </main>
  );
}
