import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import type { Currency } from "@/lib/pricing-engine";
import { requireStaff, teacherCountryIds } from "@/lib/staff";
import { createCourse } from "../admin/actions";
import { TeacherNav } from "./TeacherNav";

export const dynamic = "force-dynamic";

const card = "card p-5";
const DAY = 24 * 60 * 60 * 1000;

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return pageMetadata(params, "/teacher", "teacher", {
    key: "navHome",
    noindex: true,
  });
}

export default async function TeacherPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireStaff();
  const t = await getTranslations("teacher");
  const tc = await getTranslations("catalog");
  const ar = locale === "ar";
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );

  const [courses, profile] = await Promise.all([
    db.course.findMany({
      where: { instructorId: me.id },
      orderBy: { slug: "asc" },
      include: { grade: true, _count: { select: { skus: { where: { active: true, price: { gt: 0 } } } } } },
    }),
    db.user.findUnique({ where: { id: me.id }, select: { photoUrl: true, bioAr: true, bioEn: true } }),
  ]);
  // The first-run checklist, computed from what is stored; it disappears once every step is done.
  const setup = [
    { key: "setupPhoto", done: Boolean(profile?.photoUrl && (profile.bioAr || profile.bioEn)), href: "/teacher/profile" },
    { key: "setupCourse", done: courses.length > 0, href: "/teacher#new-course" },
    { key: "setupPrice", done: courses.some((c) => c._count.skus > 0), href: courses[0] ? `/admin/courses/${courses[0].id}` : "/teacher#new-course" },
    { key: "setupPublish", done: courses.some((c) => c.published), href: courses[0] ? `/admin/courses/${courses[0].id}` : "/teacher#new-course" },
  ] as const;
  // Every grade of the teacher's country, each with the subjects it teaches: the teacher picks any pair.
  const countryIds = await teacherCountryIds(me.id);
  const grades = await db.grade.findMany({
    where: { countryId: { in: countryIds }, active: true },
    orderBy: [
      { country: { order: "asc" } },
      { order: "asc" },
      { level: "asc" },
    ],
    select: {
      id: true,
      nameAr: true,
      nameEn: true,
      country: { select: { nameAr: true, nameEn: true } },
      subjects: {
        orderBy: { order: "asc" },
        select: {
          subject: { select: { id: true, nameAr: true, nameEn: true } },
        },
      },
    },
  });
  const manyCountries = countryIds.length > 1;
  const courseIds = courses.map((c) => c.id);

  const [subs, sold] = await Promise.all([
    db.entitlement.findMany({
      where: {
        courseId: { in: courseIds },
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: { startsAt: "desc" },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
        course: { select: { titleAr: true, titleEn: true } },
        lesson: { select: { titleAr: true, titleEn: true } },
        order: {
          select: {
            items: {
              select: {
                sku: {
                  select: {
                    courseId: true,
                    lessonId: true,
                    liveSessionId: true,
                    accessType: true,
                    accessDays: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.ledgerEntry.findMany({
      where: { instructorId: me.id, createdAt: { gte: monthStart } },
      select: { instructorNet: true, currency: true },
    }),
  ]);

  const earnings = new Map<Currency, number>();
  for (const e of sold)
    earnings.set(e.currency, (earnings.get(e.currency) ?? 0) + e.instructorNet);
  const students = new Set(subs.map((s) => s.user.id)).size;
  const newThisWeek = new Set(
    subs
      .filter((s) => now.getTime() - s.startsAt.getTime() < 7 * DAY)
      .map((s) => s.user.id),
  ).size;
  const perCourse = (id: string) =>
    new Set(subs.filter((s) => s.courseId === id).map((s) => s.user.id)).size;
  const roster = await db.entitlement.findMany({
    where: {
      courseId: { in: courseIds },
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    select: {
      userId: true,
      user: {
        select: {
          name: true,
          views: {
            orderBy: { lastSeenAt: "desc" },
            take: 1,
            select: { lastSeenAt: true },
          },
        },
      },
    },
  });
  const idleCutoff = new Date(now.getTime() - 7 * DAY);
  const seen = new Map<
    string,
    { id: string; name: string; lastSeen: Date | null }
  >();
  for (const e of roster) {
    if (seen.has(e.userId)) continue;
    seen.set(e.userId, {
      id: e.userId,
      name: e.user.name,
      lastSeen: e.user.views[0]?.lastSeenAt ?? null,
    });
  }
  const drifting = [...seen.values()]
    .filter((x) => !x.lastSeen || x.lastSeen < idleCutoff)
    .slice(0, 10);
  const date = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", {
    dateStyle: "medium",
    timeZone: "Asia/Dubai",
  });
  const money =
    [...earnings].map(([cur, n]) => formatMoney(n, cur, locale)).join(" · ") ||
    t("noSales");

  return (
    <main className="mx-auto grid max-w-4xl gap-10 px-4 py-12">
      <div className="grid gap-4">
        <h1 className="font-display text-h1 font-semibold">
          {t("hello", { name: me.name ?? "" })}
        </h1>
        <TeacherNav current="home" />
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          [t("statStudents"), String(students)],
          [t("statNew"), String(newThisWeek)],
          [t("statEarnings"), money],
        ].map(([k, v]) => (
          <div key={k} className={`${card} grid gap-1`}>
            <span className="text-label text-ink-muted">{k}</span>
            <span className="num font-display text-h2 font-semibold">{v}</span>
          </div>
        ))}
      </section>

      {me.role === "INSTRUCTOR" && setup.some((s) => !s.done) && (
        <section className="card grid gap-4 p-6">
          <div className="grid gap-1">
            <h2 className="font-display text-h2 font-semibold">{t("setupTitle")}</h2>
            <p className="text-small text-ink-muted">{t("setupHint")}</p>
          </div>
          <ol className="grid gap-2 sm:grid-cols-2">
            {setup.map((s, i) => (
              <li key={s.key}>
                <Link
                  href={s.href}
                  className={`flex min-h-11 items-center gap-3 rounded-md border p-3 transition-colors duration-(--dur-fast) ease-(--ease-out) ${s.done ? "border-hairline text-ink-muted" : "border-primary/30 bg-primary/5 hover:bg-primary/10"}`}
                >
                  <span
                    aria-hidden="true"
                    className={`grid size-7 shrink-0 place-items-center rounded-full text-label font-semibold ${s.done ? "bg-up text-on-primary" : "bg-primary text-on-primary"}`}
                  >
                    {s.done ? "✓" : i + 1}
                  </span>
                  <span className={s.done ? "line-through" : "font-medium"}>{t(s.key)}</span>
                  {s.done && <span className="sr-only">{t("setupDone")}</span>}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {me.role === "INSTRUCTOR" && (
        <section id="new-course" className="grid scroll-mt-24 gap-3">
          <h2 className="font-display text-h2 font-semibold">
            {t("newCourse")}
          </h2>
          {grades.length === 0 ? (
            <p className="text-small text-ink-muted">{t("noSlots")}</p>
          ) : (
            <form action={createCourse} className={`${card} grid gap-3`}>
              <input type="hidden" name="locale" value={locale} />
              <p className="text-small text-ink-muted">{t("ownCourses")}</p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="grid gap-1 text-small">
                  {t("newCourseHint")}
                  <select
                    name="slot"
                    required
                    className="min-w-56 rounded-sm border border-rule bg-surface px-3 py-2"
                  >
                    {grades.map((g) => (
                      <optgroup
                        key={g.id}
                        label={`${manyCountries ? `${ar ? g.country.nameAr : g.country.nameEn} · ` : ""}${ar ? g.nameAr : g.nameEn}`}
                      >
                        {g.subjects.map(({ subject: s }) => (
                          <option key={s.id} value={`${g.id}:${s.id}`}>
                            {ar ? s.nameAr : s.nameEn} ·{" "}
                            {ar ? g.nameAr : g.nameEn}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <button className="btn btn-primary text-small">
                  {t("createCourse")}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      <section id="courses" className="grid scroll-mt-24 gap-3">
        <h2 className="font-display text-h2 font-semibold">{t("myCourses")}</h2>
        {courses.length === 0 ? (
          <EmptyState>
            <p className="text-ink-muted">{t("noCourses")}</p>
          </EmptyState>
        ) : (
          <ul className="grid gap-2">
            {courses.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/courses/${c.id}`}
                  className={`${card} flex flex-wrap items-center justify-between gap-3 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised`}
                >
                  <span className="grid gap-1">
                    <span className="font-display font-semibold">
                      {ar ? c.titleAr : c.titleEn}
                    </span>
                    <span className="text-small text-ink-muted">
                      {c.grade
                        ? ar
                          ? c.grade.nameAr
                          : c.grade.nameEn
                        : tc("skill")}
                    </span>
                  </span>
                  <span className="flex items-center gap-4 text-label">
                    <span className="num text-ink-muted">
                      {t("courseStudents", { count: perCourse(c.id) })}
                    </span>
                    <span
                      className={c.published ? "text-up" : "text-ink-muted"}
                    >
                      {c.published ? t("published") : t("hidden")}
                    </span>
                    <span className="text-pen">{t("edit")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-semibold">
          {t("myStudents")}
        </h2>
        {subs.length === 0 ? (
          <EmptyState>
            <p className="text-ink-muted">{t("noStudents")}</p>
          </EmptyState>
        ) : (
          <ul className="grid gap-2">
            {subs.map((s) => {
              const sku = s.order?.items.find(
                (i) =>
                  i.sku.courseId === s.courseId &&
                  i.sku.lessonId === s.lessonId &&
                  i.sku.liveSessionId === s.liveSessionId,
              )?.sku;
              return (
                <li
                  key={s.id}
                  className={`${card} flex flex-wrap items-center justify-between gap-x-6 gap-y-2`}
                >
                  <span className="grid gap-1">
                    <span className="font-display font-semibold">
                      {s.user.name}
                    </span>
                    <span className="num text-small text-ink-muted" dir="ltr">
                      {s.user.phone ?? s.user.email}
                    </span>
                  </span>
                  <span className="grid gap-1 text-small sm:text-end">
                    <span>
                      {ar ? s.course.titleAr : s.course.titleEn}
                      {s.lesson &&
                        ` · ${ar ? s.lesson.titleAr : s.lesson.titleEn}`}
                      {sku &&
                        ` · ${tc(`access.${sku.accessType}`, { days: sku.accessDays ?? 0 })}`}
                    </span>
                    <span className="text-ink-muted">
                      {s.endsAt
                        ? t("until", { date: date.format(s.endsAt) })
                        : t("forever")}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {drifting.length > 0 && (
        <section className="grid gap-3">
          <h2 className="font-display text-h2 font-semibold">
            {t("earlyWarning")}
          </h2>
          <p className="text-small text-ink-muted">{t("earlyWarningHint")}</p>
          <ul className="grid gap-2">
            {drifting.map((x) => (
              <li
                key={x.id}
                className={
                  card +
                  " flex flex-wrap items-center justify-between gap-2 text-small"
                }
              >
                <span className="font-semibold">{x.name}</span>
                <span className="num text-ink-muted">
                  {t("lastSeen", {
                    date: x.lastSeen ? date.format(x.lastSeen) : t("never"),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
