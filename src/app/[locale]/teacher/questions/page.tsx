import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/staff";
import { field } from "../../admin/styles";
import { SaveButton } from "../../admin/ui";
import { TeacherNav } from "../TeacherNav";
import { answerQuestion } from "./actions";

export const dynamic = "force-dynamic";

/** Questions on the teacher's own courses (every course for an admin): unanswered first, oldest first. */
export default async function TeacherQuestionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireStaff();
  const t = await getTranslations("questions");
  const tt = await getTranslations("teacher");
  const ar = locale === "ar";
  const mine = me.role === "ADMIN" ? {} : { lesson: { unit: { course: { instructorId: me.id } } } };
  const include = {
    user: { select: { name: true } },
    answeredBy: { select: { name: true } },
    lesson: { select: { id: true, titleAr: true, titleEn: true, unit: { select: { course: { select: { slug: true, titleAr: true, titleEn: true } } } } } },
  };
  const [open, answered] = await Promise.all([
    db.question.findMany({ where: { ...mine, answeredAt: null }, orderBy: { createdAt: "asc" }, include }),
    db.question.findMany({ where: { ...mine, answeredAt: { not: null } }, orderBy: { answeredAt: "desc" }, take: 20, include }),
  ]);
  const when = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dubai" });

  const item = (q: (typeof open)[number]) => (
    <li key={q.id} className="grid gap-3 rounded-md border border-hairline bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-small text-ink-muted">
        <Link href={`/courses/${q.lesson.unit.course.slug}/lessons/${q.lesson.id}`} className="text-pen underline-offset-4 hover:underline">
          {ar ? q.lesson.unit.course.titleAr : q.lesson.unit.course.titleEn} · {ar ? q.lesson.titleAr : q.lesson.titleEn}
        </Link>
        <span>
          {q.user.name} · <span className="num">{when.format(q.createdAt)}</span>
        </span>
      </div>
      <p dir="auto" className="whitespace-pre-line">{q.body}</p>
      <form action={answerQuestion} className="grid gap-2">
        <input type="hidden" name="id" value={q.id} />
        <textarea name="answer" defaultValue={q.answer ?? ""} required maxLength={4000} rows={3} aria-label={t("answer")} placeholder={t("answer")} dir="auto" className={`${field} py-2`} />
        <span className="text-label text-ink-muted">{t("contactRule")}</span>
        {q.answeredBy && <span className="text-label text-ink-muted">{t("answeredBy", { name: q.answeredBy.name })}</span>}
        <div>
          <SaveButton>{q.answer ? t("update") : t("send")}</SaveButton>
        </div>
      </form>
    </li>
  );

  return (
    <main className="mx-auto grid max-w-3xl gap-10 px-4 py-12">
      <div className="grid gap-4">
        <h1 className="font-display text-h1 font-semibold">{tt("navQuestions")}</h1>
        <TeacherNav current="questions" />
      </div>
      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-semibold">{t("unanswered", { count: open.length })}</h2>
        {open.length ? <ul className="grid gap-3">{open.map(item)}</ul> : <EmptyState><p className="text-ink-muted">{t("allAnswered")}</p></EmptyState>}
      </section>
      {answered.length > 0 && (
        <section className="grid gap-3">
          <h2 className="font-display text-h2 font-semibold">{t("recent")}</h2>
          <ul className="grid gap-3">{answered.map(item)}</ul>
        </section>
      )}
    </main>
  );
}
