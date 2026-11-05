import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StatTile } from "@/components/ui/StatTile";
import { db } from "@/lib/db";
import { average, byUnit, type Score } from "@/lib/grades";
import { requireStaff } from "@/lib/staff";
import { TeacherNav } from "../TeacherNav";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/teacher/analytics", "homework", { key: "strengths", noindex: true });
}

export default async function TeacherAnalyticsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireStaff();
  const t = await getTranslations("homework");
  const ar = locale === "ar";

  const courses = await db.course.findMany({
    where: me.role === "ADMIN" ? {} : { instructorId: me.id },
    select: { id: true, titleAr: true, titleEn: true },
  });
  const courseIds = courses.map((c) => c.id);
  const courseNames = new Map(courses.map((c) => [c.id, ar ? c.titleAr : c.titleEn]));

  const graded = await db.submission.findMany({
    where: { assignment: { courseId: { in: courseIds } }, status: "GRADED", score: { not: null } },
    select: {
      score: true,
      student: { select: { id: true, name: true } },
      assignment: {
        select: {
          id: true,
          title: true,
          maxScore: true,
          courseId: true,
          lesson: { select: { unit: { select: { id: true, titleAr: true, titleEn: true, courseId: true } } } },
        },
      },
    },
  });

  // Exam papers are course-level work and were missing from every figure here. They carry no unit,
  // so they join the class and per-student averages but not the per-unit breakdown.
  const examMarks = await db.examAttempt.findMany({
    where: { status: "GRADED", marks: { not: null }, paper: { courseId: { in: courseIds } } },
    select: { marks: true, maxMarks: true, userId: true, user: { select: { id: true, name: true } } },
  });

  // Per student, the average across everything graded.
  const byStudent = new Map<string, { name: string; scores: Score[] }>();
  // Per assignment, the average and how many are in.
  const byAssignment = new Map<string, { title: string; course: string; scores: Score[] }>();
  // Per unit, only units with enough marks to name.
  const unitScores = new Map<string, { name: string; course: string; scores: Score[] }>();

  for (const s of graded) {
    if (s.score === null) continue;
    const score: Score = { value: s.score, max: s.assignment.maxScore };

    const st = byStudent.get(s.student.id) ?? { name: s.student.name, scores: [] };
    st.scores.push(score);
    byStudent.set(s.student.id, st);

    const a = byAssignment.get(s.assignment.id) ?? {
      title: s.assignment.title,
      course: courseNames.get(s.assignment.courseId) ?? "",
      scores: [],
    };
    a.scores.push(score);
    byAssignment.set(s.assignment.id, a);

    const unit = s.assignment.lesson?.unit;
    if (unit) {
      const u = unitScores.get(unit.id) ?? { name: ar ? unit.titleAr : unit.titleEn, course: courseNames.get(unit.courseId) ?? "", scores: [] };
      u.scores.push({ ...score, unitId: unit.id });
      unitScores.set(unit.id, u);
    }
  }

  for (const e of examMarks) {
    const st = byStudent.get(e.userId) ?? { name: e.user.name, scores: [] };
    st.scores.push({ value: e.marks!, max: e.maxMarks });
    byStudent.set(e.userId, st);
  }

  const students = [...byStudent.entries()]
    .map(([id, v]) => ({ id, name: v.name, ...average(v.scores)! }))
    .sort((a, b) => b.avg - a.avg);
  const classAverage = average([
    ...graded.filter((s) => s.score !== null).map((s) => ({ value: s.score!, max: s.assignment.maxScore })),
    ...examMarks.map((e) => ({ value: e.marks!, max: e.maxMarks })),
  ]);

  // Units with at least three graded marks, weakest first: the honest "where the class struggles".
  const units = [...unitScores.entries()]
    .flatMap(([id, v]) => {
      const found = byUnit(v.scores, 3).find((u) => u.unitId === id);
      return found ? [{ id, name: v.name, course: v.course, ...found }] : [];
    })
    .sort((a, b) => a.avg - b.avg);

  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 py-12">
      <TeacherNav current="analytics" />
      <h1 className="font-display text-h1 font-semibold">{t("strengths")}</h1>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatTile label={t("average")} value={classAverage ? `${classAverage.avg}%` : "—"} hint={classAverage ? t("sample", { n: classAverage.n }) : t("notEnough")} />
        <StatTile label={t("submissions")} value={graded.length} />
        <StatTile label={t("weakest")} value={units.length > 0 ? `${units[0].avg}%` : "—"} hint={units[0]?.name ?? t("noUnits")} />
      </div>

      <section className="grid gap-2">
        <h2 className="font-display text-h2 font-semibold">{t("average")}</h2>
        {students.length === 0 ? (
          <p className="text-small text-ink-muted">{t("notEnough")}</p>
        ) : (
          <ul className="grid gap-1">
            {students.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface shadow-paper px-3 py-2 text-small">
                <span>{s.name}</span>
                <span className="num">
                  {s.avg}% · {t("sample", { n: s.n })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-2">
        <h2 className="font-display text-h2 font-semibold">{t("submissions")}</h2>
        <ul className="grid gap-1">
          {[...byAssignment.entries()].map(([id, a]) => {
            const avg = average(a.scores);
            return (
              <li key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hairline bg-surface shadow-paper px-3 py-2 text-small">
                <span className="min-w-0">
                  <span className="block truncate" dir="auto">{a.title}</span>
                  <span className="text-label text-ink-muted">{a.course}</span>
                </span>
                <span className="num">{avg ? `${avg.avg}% · ${t("sample", { n: avg.n })}` : "—"}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="grid gap-2">
        <h2 className="font-display text-h2 font-semibold">{t("weakest")}</h2>
        {units.length === 0 ? (
          <p className="text-small text-ink-muted">{t("noUnits")}</p>
        ) : (
          <ul className="grid gap-1">
            {units.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface shadow-paper px-3 py-2 text-small">
                <span className="min-w-0">
                  <span className="block truncate">{u.name}</span>
                  <span className="text-label text-ink-muted">{u.course}</span>
                </span>
                <span className="num">
                  {u.avg}% · {t("sample", { n: u.n })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
