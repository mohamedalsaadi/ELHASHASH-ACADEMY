import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/staff";
import { AdminNav, panel, table } from "../AdminNav";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const HOUR = 3_600_000;

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export default async function AdminQuestionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("office");
  const now = new Date();

  // Each question belongs to its course's teacher, whoever answered it: the last 90 days plus anything still open.
  const questions = await db.question.findMany({
    where: { OR: [{ createdAt: { gt: new Date(now.getTime() - 90 * DAY) } }, { answeredAt: null }] },
    select: { createdAt: true, answeredAt: true, lesson: { select: { unit: { select: { course: { select: { instructor: { select: { id: true, name: true } } } } } } } } },
  });
  const rows = [...Map.groupBy(questions, (q) => q.lesson.unit.course.instructor.id).values()]
    .map((qs) => {
      const open = qs.filter((q) => !q.answeredAt);
      const waits = qs.flatMap((q) => (q.answeredAt ? [q.answeredAt.getTime() - q.createdAt.getTime()] : []));
      return {
        name: qs[0].lesson.unit.course.instructor.name,
        answered: waits.length,
        open: open.length,
        median: median(waits),
        oldest: open.length ? Math.max(...open.map((q) => now.getTime() - q.createdAt.getTime())) : null,
      };
    })
    .sort((a, b) => (b.oldest ?? 0) - (a.oldest ?? 0));
  const span = (ms: number | null) => (ms === null ? "—" : ms < DAY ? t("hours", { n: Math.max(1, Math.round(ms / HOUR)) }) : t("days", { n: Math.round(ms / DAY) }));

  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 py-12">
      <AdminNav current="questions" />
      <p className="text-small text-ink-muted">{t("questionsHint")}</p>
      <section className={`${panel} overflow-x-auto`}>
        {rows.length ? (
          <table className={table}>
            <thead>
              <tr>
                <th>{t("teacher")}</th>
                <th>{t("answered")}</th>
                <th>{t("unanswered")}</th>
                <th>{t("medianReply")}</th>
                <th>{t("oldestOpen")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td className="font-medium">{r.name}</td>
                  <td className="num">{r.answered}</td>
                  <td className={`num ${r.open ? "font-semibold text-pen" : ""}`}>{r.open}</td>
                  <td className="num">{span(r.median)}</td>
                  <td className={`num ${r.oldest !== null && r.oldest > 2 * DAY ? "font-semibold text-down" : ""}`}>{span(r.oldest)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-small text-ink-muted">{t("noQuestions")}</p>
        )}
      </section>
    </main>
  );
}
