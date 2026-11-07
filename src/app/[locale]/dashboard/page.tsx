import { pick } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { EmptyState } from "@/components/brand/Mark";
import { LiveRow } from "@/components/learning/LiveRow";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { courseZone, currencyZone, formatDate, formatMoney, formatWhen } from "@/lib/format";
import { opensAssignment } from "@/lib/assignments";
import { average } from "@/lib/grades";
import { courseProgress, groupLive, lessonEntries, livePhase, nextOpenLesson, roomOpensAt, LIVE_LEAD_MIN } from "@/lib/learning";
import { liveOffered } from "@/lib/live";
import { opensLesson, type Grant } from "@/lib/plans";
import { ProgressBar } from "@/components/ui/progress";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { StatusChip } from "@/components/ui/StatusChip";
import { saveDateOfBirth } from "./actions";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/dashboard", "dashboard", { key: "title", noindex: true });
}

const endValue = (g: Grant) => (g.endsAt ? g.endsAt.getTime() : Number.POSITIVE_INFINITY);
const isLive = (g: Grant, now: Date) => !g.endsAt || g.endsAt > now;

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/dashboard`)}`);
  if (session.user.role === "INSTRUCTOR") redirect(`/${locale}/teacher`);
  if (session.user.role === "PARENT") redirect(`/${locale}/parent`);

  const [t, tc, tq, tm, tl, th, tpr] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("catalog"),
    getTranslations("questions"),
    getTranslations("checkout"),
    getTranslations("live"),
    getTranslations("homework"),
    getTranslations("practice"),
  ]);
  const ar = locale === "ar";
  const now = new Date();
  const userId = session.user.id;
  const profile = await db.user.findUnique({ where: { id: userId }, select: { dateOfBirth: true, phone: true, gradeId: true } });
  // A first Google sign-in has an account but no phone or grade yet.
  if (session.user.role === "STUDENT" && (!profile?.phone || !profile.gradeId)) redirect(`/${locale}/complete-profile`);

  const [entitlements, completedViews, lastView, orders, answers] = await Promise.all([
    db.entitlement.findMany({
      where: { userId, startsAt: { lte: now }, course: { published: true } },
      select: {
        id: true,
        courseId: true,
        lessonId: true,
        liveSessionId: true,
        accessType: true,
        term: true,
        month: true,
        startsAt: true,
        endsAt: true,
        course: {
          select: {
            slug: true,
            titleAr: true,
            titleEn: true,
            grade: { select: { nameAr: true, nameEn: true, country: { select: { timeZone: true } } } },
          },
        },
        lesson: { select: { id: true, titleAr: true, titleEn: true } },
      },
    }),
    db.lessonView.findMany({ where: { userId, completedAt: { not: null } }, select: { lessonId: true } }),
    db.lessonView.findFirst({
      where: { userId, completedAt: null, lesson: { unit: { course: { published: true } } } },
      orderBy: { lastSeenAt: "desc" },
      select: {
        lesson: {
          select: {
            id: true,
            titleAr: true,
            titleEn: true,
            month: true,
            unit: { select: { term: true, courseId: true, course: { select: { slug: true, titleAr: true, titleEn: true } } } },
          },
        },
      },
    }),
    db.order.findMany({
      where: { userId, status: { in: ["PENDING", "PAID", "REFUNDED"] } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, status: true, method: true, gateway: true, kioskRef: true, total: true, currency: true, expiresAt: true, paidAt: true },
    }),
    db.question.findMany({
      where: { userId, answeredAt: { gt: new Date(now.getTime() - 14 * 86_400_000) } },
      orderBy: { answeredAt: "desc" },
      take: 5,
      select: {
        id: true,
        lessonId: true,
        answer: true,
        answeredBy: { select: { name: true } },
        lesson: { select: { titleAr: true, titleEn: true, unit: { select: { course: { select: { slug: true } } } } } },
      },
    }),
  ]);

  const completed = new Set(completedViews.map((v) => v.lessonId));

  const grantOf = (e: (typeof entitlements)[number]): Grant => ({
    accessType: e.accessType,
    lessonId: e.lessonId,
    liveSessionId: e.liveSessionId,
    term: e.term,
    month: e.month,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
  });

  const grantsByCourse = new Map<string, Grant[]>();
  for (const e of entitlements) {
    const list = grantsByCourse.get(e.courseId) ?? [];
    list.push(grantOf(e));
    grantsByCourse.set(e.courseId, list);
  }
  const activeGrants = (courseId: string) => (grantsByCourse.get(courseId) ?? []).filter((g) => isLive(g, now));

  // One row per course the student has ever held, with its best active grant (or the last lapsed one).
  const courseMeta = new Map<string, (typeof entitlements)[number]["course"]>();
  for (const e of entitlements) if (!e.lessonId && !e.liveSessionId && e.course) courseMeta.set(e.courseId, e.course);

  const courses = [...courseMeta.entries()].map(([courseId, course]) => {
    const grants = grantsByCourse.get(courseId) ?? [];
    const active = grants.filter((g) => isLive(g, now)).sort((a, b) => endValue(b) - endValue(a));
    const lapsed = grants.filter((g) => g.endsAt && g.endsAt <= now).sort((a, b) => endValue(b) - endValue(a))[0];
    return { courseId, course, active: active[0], grants, lapsed };
  });
  const liveCourses = courses.filter((c) => c.active);

  const rentals = entitlements
    .filter((e) => e.lessonId && isLive(grantOf(e), now))
    .sort((a, b) => (a.endsAt?.getTime() ?? Number.POSITIVE_INFINITY) - (b.endsAt?.getTime() ?? Number.POSITIVE_INFINITY));
  const seats = entitlements.filter((e) => e.liveSessionId && isLive(grantOf(e), now));

  const [structures, liveAll] = await Promise.all([
    db.course.findMany({
      where: { id: { in: liveCourses.map((c) => c.courseId) } },
      select: {
        id: true,
        units: {
          orderBy: { order: "asc" },
          select: {
            order: true,
            isFree: true,
            term: true,
            lessons: { orderBy: { order: "asc" }, select: { id: true, order: true, month: true, titleAr: true, titleEn: true } },
          },
        },
      },
    }),
    db.liveSession.findMany({
      where: {
        // Only approved teachers' sessions are offered; the seat rule below is unchanged.
        ...liveOffered,
        startsAt: { gt: new Date(now.getTime() - 5 * 3_600_000) },
        OR: [
          { courseId: { in: liveCourses.filter((c) => c.active && c.active.accessType !== "MONTHLY").map((c) => c.courseId) } },
          { id: { in: seats.map((s) => s.liveSessionId!) } },
        ],
      },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        courseId: true,
        titleAr: true,
        titleEn: true,
        startsAt: true,
        durationMin: true,
        course: { select: { titleAr: true, titleEn: true, grade: { select: { country: { select: { timeZone: true } } } } } },
      },
    }),
  ]);

  const unitsByCourse = new Map(structures.map((s) => [s.id, s.units]));
  const progressOf = (courseId: string) =>
    courseProgress(lessonEntries(unitsByCourse.get(courseId) ?? []), activeGrants(courseId), completed, now);

  const live = groupLive(liveAll, now);
  const liveList = [...live.now, ...live.soon, ...live.later];
  const nextLive = live.now[0] ?? live.soon[0];

  const [homeworkAll, gradedRows] = await Promise.all([
    db.assignment.findMany({
      where: { courseId: { in: liveCourses.map((c) => c.courseId) } },
      orderBy: [{ dueAt: "asc" }],
      take: 50,
      select: {
        id: true,
        title: true,
        dueAt: true,
        courseId: true,
        lesson: { select: { id: true, month: true, unit: { select: { term: true, isFree: true } } } },
        course: { select: { slug: true, grade: { select: { country: { select: { timeZone: true } } } } } },
        submissions: { where: { studentId: userId }, select: { id: true, status: true } },
      },
    }),
    db.submission.findMany({
      where: { studentId: userId, status: "GRADED", score: { not: null } },
      select: { score: true, assignment: { select: { maxScore: true } } },
    }),
  ]);
  const progressRow = await db.studentProgress.findUnique({ where: { userId }, select: { xp: true, currentStreak: true } });
  const dueReviews = await db.reviewSchedule.findMany({ where: { userId, dueAt: { lte: now } }, take: 5, select: { id: true } });
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000);
  const homework = homeworkAll
    .filter((a) => opensAssignment({ courseId: a.courseId, lesson: a.lesson }, activeGrants(a.courseId), now))
    .map((a) => {
      const sub = a.submissions[0];
      const open = !sub;
      return {
        ...a,
        submitted: !!sub,
        overdue: open && !!a.dueAt && a.dueAt < now,
        soon: open && !!a.dueAt && a.dueAt >= now && a.dueAt <= weekAhead,
      };
    });
  const dueSoon = homework.filter((a) => a.soon).length;
  const overdueCount = homework.filter((a) => a.overdue).length;
  const homeworkAvg = average(gradedRows.filter((r) => r.score !== null).map((r) => ({ value: r.score!, max: r.assignment.maxScore })));
  const nextHomework = homework.filter((a) => !a.submitted && a.dueAt && a.dueAt <= weekAhead).slice(0, 3);


  // ---- next action: one primary on the page ------------------------------------------------
  const pending = orders.find((o) => o.status === "PENDING");
  const hasAccess = liveCourses.length > 0 || rentals.length > 0 || seats.length > 0;

  const lastOpen =
    lastView &&
    activeGrants(lastView.lesson.unit.courseId).some((g) =>
      opensLesson(g, { id: lastView.lesson.id, month: lastView.lesson.month, term: lastView.lesson.unit.term }, now),
    );

  const nextByCourse = liveCourses
    .map((c) => ({
      course: c,
      entry: nextOpenLesson(lessonEntries(unitsByCourse.get(c.courseId) ?? []), activeGrants(c.courseId), completed, now),
    }))
    .find((x) => x.entry);

  const next =
    nextLive && roomOpensAt(nextLive.startsAt, LIVE_LEAD_MIN.student) <= now
      ? {
          href: `/live/${nextLive.id}`,
          eyebrow: t("nextAction.eyebrow"),
          title: pick(ar, nextLive.titleAr, nextLive.titleEn),
          subtitle: pick(ar, nextLive.course.titleAr, nextLive.course.titleEn),
          cta: tl("joinNow"),
        }
      : pending && !hasAccess
        ? {
            href: `/checkout/result?order=${pending.id}`,
            eyebrow: t("nextAction.eyebrow"),
            title: t("payments.pendingTitle"),
            subtitle: t("payments.pendingHint"),
            cta: t("payments.checkout"),
          }
        : lastView && lastOpen
          ? {
              href: `/courses/${lastView.lesson.unit.course.slug}/lessons/${lastView.lesson.id}`,
              eyebrow: t("nextAction.eyebrow"),
              title: pick(ar, lastView.lesson.titleAr, lastView.lesson.titleEn),
              subtitle: pick(ar, lastView.lesson.unit.course.titleAr, lastView.lesson.unit.course.titleEn),
              cta: t("resume"),
            }
          : nextByCourse?.entry
            ? {
                href: `/courses/${nextByCourse.course.course.slug}/lessons/${nextByCourse.entry.lesson.id}`,
                eyebrow: t("nextAction.eyebrow"),
                title: pick(ar, nextByCourse.entry.lesson.titleAr, nextByCourse.entry.lesson.titleEn),
                subtitle: pick(ar, nextByCourse.course.course.titleAr, nextByCourse.course.course.titleEn),
                cta: t("nextAction.start"),
              }
            : null;

  // Summary first (DESIGN.md §2): real counts only, zeros left out. A running streak is earned, so it alone carries the
  // summit point.
  const streak = progressRow?.currentStreak ?? 0;
  const summary = [
    { label: t("summary.completedLessons"), value: completed.size as React.ReactNode, n: completed.size },
    { label: t("summary.activeCourses"), value: liveCourses.length, n: liveCourses.length },
    { label: t("summary.upcomingLive"), value: liveList.length, n: liveList.length },
    { label: tpr("xpEarned"), value: progressRow?.xp ?? 0, n: progressRow?.xp ?? 0 },
    {
      label: tpr("streak"),
      value: (
        <span className="inline-flex items-center gap-2">
          {streak}
          <span aria-hidden="true" className="size-2 rounded-full bg-summit" />
        </span>
      ),
      n: streak,
    },
  ].filter((s) => s.n > 0);

  const paid = orders.filter((o) => o.status === "PAID" || o.status === "REFUNDED").slice(0, 3);

  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-4 py-12">
      <PageHeader title={t("hello", { name: session.user.name ?? "" })} />

      {!profile?.dateOfBirth && (
        <section className="card grid gap-3 p-5">
          <div className="grid gap-1">
            <h2 className="font-display text-h3 font-semibold">{t("dobTitle")}</h2>
            <p className="text-small text-ink-muted">{t("dobHint")}</p>
          </div>
          <form action={saveDateOfBirth} className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-label text-ink-muted">
              {t("dobLabel")}
              <input
                type="date"
                name="dateOfBirth"
                required
                max={now.toISOString().slice(0, 10)}
                className="min-h-11 rounded-sm border border-rule bg-surface px-3 text-body text-ink"
              />
            </label>
            <button className="btn btn-outline">{t("dobSave")}</button>
          </form>
        </section>
      )}

      {summary.length > 0 && (
        <section className="grid gap-3">
          <h2 className="font-display text-h2 font-semibold">{t("summary.title")}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {summary.map((s) => (
              <StatTile key={s.label} label={s.label} value={s.value} />
            ))}
          </div>
        </section>
      )}

      {dueReviews.length > 0 && (
        <Link
          href="/review"
          className="grid gap-1 card border-pen p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
        >
          <span className="text-label font-medium text-pen">{tpr("reviewTitle")}</span>
          <span className="font-display font-semibold">{tpr("reviewDue", { count: dueReviews.length })}</span>
          <span className="text-small text-pen">{tpr("reviewStart")}</span>
        </Link>
      )}

      <section className="grid gap-2">
        <h2 className="font-display text-h2 font-semibold">{th("title")}</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2">
          {dueSoon > 0 && <StatTile label={th("dueSoon")} value={dueSoon} />}
          {overdueCount > 0 && <StatTile label={th("overdue")} value={overdueCount} />}
          <StatTile label={th("homeworkAverage")} value={homeworkAvg ? `${homeworkAvg.avg}%` : "—"} hint={homeworkAvg ? th("sample", { n: homeworkAvg.n }) : undefined} />
        </div>
        {nextHomework.length > 0 && (
          <ul className="grid gap-1">
            {nextHomework.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/courses/${a.course.slug}/assignments/${a.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 card px-3 py-2 text-small transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
                >
                  <span className="min-w-0 truncate" dir="auto">{a.title}</span>
                  <span className="num text-label text-ink-muted">
                    {a.dueAt ? formatDate(a.dueAt, courseZone(a.course), locale) : th("noDue")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {next ? (
        <Link
          href={next.href}
          className="grid gap-1 card border-pen p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
        >
          <span className="text-label font-medium text-pen">{next.eyebrow}</span>
          <span className="font-display font-semibold">{next.title}</span>
          {next.subtitle && <span className="text-small text-ink-muted">{next.subtitle}</span>}
          <span className="text-small text-pen">{next.cta}</span>
        </Link>
      ) : (
        !hasAccess && (
          <EmptyState>
            <p className="text-ink-muted">{t("empty")}</p>
            <Link href="/courses" className="btn btn-primary w-fit">
              {t("browse")}
            </Link>
          </EmptyState>
        )
      )}

      {pending && (
        <section className="grid gap-2">
          <h2 className="font-display text-h2 font-semibold">{t("payments.pendingTitle")}</h2>
          <div className="grid gap-1 card p-4 text-small">
            <span className="num font-semibold">{formatMoney(pending.total, pending.currency, locale)}</span>
            <span className="text-ink-muted">
              {pending.method ? tm(`methods.${pending.method}.name`) : pending.gateway}
            </span>
            {pending.kioskRef && (
              <span className="text-ink-muted">
                {t("payments.kioskRef")}: <span className="num" dir="ltr">{pending.kioskRef}</span>
              </span>
            )}
            {pending.expiresAt && (
              <span className="text-ink-muted">
                {t("payments.payBy", { date: formatDate(pending.expiresAt, currencyZone(pending.currency), locale) })}
              </span>
            )}
            <Link href={`/checkout/result?order=${pending.id}`} className="w-fit text-pen underline underline-offset-4">
              {t("payments.checkout")}
            </Link>
          </div>
        </section>
      )}

      {liveList.length > 0 && (
        <section className="grid gap-3">
          <h2 className="font-display text-h2 font-semibold">{t("myLive")}</h2>
          <ul className="grid gap-3">
            {liveList.map((l) => {
              const phase = livePhase(l.startsAt, l.durationMin, now);
              const opens = roomOpensAt(l.startsAt, LIVE_LEAD_MIN.student) <= now;
              const minutes = Math.max(1, Math.round((l.startsAt.getTime() - now.getTime()) / 60_000));
              return (
                <li key={l.id}>
                  <LiveRow
                    href={`/live/${l.id}`}
                    title={pick(ar, l.titleAr, l.titleEn)}
                    subtitle={pick(ar, l.course.titleAr, l.course.titleEn)}
                    when={formatWhen(l.startsAt, courseZone(l.course), locale)}
                    phase={phase === "ended" ? "later" : phase}
                    phaseLabel={phase === "now" ? tl("liveNow") : phase === "soon" ? tl("startsSoon", { minutes }) : tl("later")}
                    action={
                      opens ? (
                        <span className="font-semibold text-pen">{tl("joinNow")}</span>
                      ) : (
                        <span className="text-ink-muted">{tl("details")}</span>
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(liveCourses.length > 0 || courses.some((c) => c.lapsed)) && (
        <section className="grid gap-4">
          <h2 className="font-display text-h2 font-semibold">{t("myCourses")}</h2>
          <ul className="grid gap-3">
            {courses.map(({ courseId, course, active, lapsed }) => {
              const progress = active ? progressOf(courseId) : null;
              const expiring = !!active?.endsAt && active.endsAt.getTime() - now.getTime() <= 7 * 86_400_000;
              return (
                <li key={courseId}>
                  <Link
                    href={active ? `/courses/${course.slug}` : `/courses/${course.slug}#packages`}
                    className="grid gap-2 card p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
                  >
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2 font-display font-semibold">
                        {pick(ar, course.titleAr, course.titleEn)}
                        {/* The summit point: every lesson in the course is done. */}
                        {progress && progress.total > 0 && progress.done === progress.total && (
                          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-summit" />
                        )}
                      </span>
                      {active ? (
                        <StatusChip tone={expiring ? "expiring" : "active"}>
                          {active.accessType ? tc(`planKind.${active.accessType}`) : t("forever")}
                        </StatusChip>
                      ) : (
                        <StatusChip tone="expired">{t("plan.renew")}</StatusChip>
                      )}
                    </span>
                    <span className="text-small text-ink-muted">
                      {course.grade ? (pick(ar, course.grade.nameAr, course.grade.nameEn)) : tc("skill")}
                      {active?.endsAt
                        ? ` · ${t("until", { date: formatDate(active.endsAt, courseZone(course), locale) })}`
                        : lapsed?.endsAt
                          ? ` · ${t("plan.expired")}`
                          : ""}
                    </span>
                    {progress && progress.total > 0 && (
                      <ProgressBar done={progress.done} total={progress.total} label={t("progressLabel")} />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {courses.length === 0 && rentals.length > 0 && (
        <p className="text-small text-ink-muted">{t("plan.rentalOnly")}</p>
      )}
      {courses.length === 0 && rentals.length === 0 && seats.length > 0 && (
        <p className="text-small text-ink-muted">{t("plan.seatOnly")}</p>
      )}

      {rentals.length > 0 && (
        <section className="grid gap-3">
          <h2 className="font-display text-h2 font-semibold">{t("myRentals")}</h2>
          <ul className="grid gap-3">
            {rentals.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/courses/${e.course?.slug}/lessons/${e.lesson!.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 card p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
                >
                  <span className="grid min-w-0 gap-1">
                    <span className="font-display font-semibold">{pick(ar, e.lesson!.titleAr, e.lesson!.titleEn)}</span>
                    <span className="text-small text-ink-muted">{e.course ? (pick(ar, e.course.titleAr, e.course.titleEn)) : ""}</span>
                  </span>
                  <span className="text-small text-up">
                    {e.endsAt ? t("until", { date: formatDate(e.endsAt, courseZone(e.course), locale) }) : t("forever")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {answers.length > 0 && (
        <section className="grid gap-3">
          <h2 className="font-display text-h2 font-semibold">{tq("newAnswers")}</h2>
          <ul className="grid gap-2">
            {answers.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/courses/${q.lesson.unit.course.slug}/lessons/${q.lessonId}#questions`}
                  className="grid gap-1 card p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
                >
                  <span className="text-small text-ink-muted">{pick(ar, q.lesson.titleAr, q.lesson.titleEn)}</span>
                  <span dir="auto" className="line-clamp-2">{q.answer}</span>
                  <span className="text-label font-semibold text-pen">{tq("answeredBy", { name: q.answeredBy?.name ?? "" })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {paid.length > 0 && (
        <section className="grid gap-3">
          <h2 className="font-display text-h2 font-semibold">{t("payments.receipts")}</h2>
          <ul className="grid gap-2">
            {paid.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/orders/${o.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 card p-4 text-small transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
                >
                  <span className="num">{formatMoney(o.total, o.currency, locale)}</span>
                  <span className="text-ink-muted">
                    {o.paidAt ? formatDate(o.paidAt, currencyZone(o.currency), locale) : ""}
                  </span>
                  <span className="text-pen underline underline-offset-4">{t("payments.viewReceipt")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
