import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { logEventLater } from "@/lib/analytics";
import { EmptyState } from "@/components/brand/Mark";
import { JsonLd } from "@/components/JsonLd";
import { LiveRow } from "@/components/learning/LiveRow";
import { LessonRow } from "@/components/learning/LessonRow";
import { Link } from "@/i18n/navigation";
import { grantsFor, isCourseStaff, onSale } from "@/lib/catalog";
import { pick } from "@/lib/content";
import { db } from "@/lib/db";
import { courseZone, formatDate, formatMoney, formatWhen, minorPerUnit } from "@/lib/format";
import { liveApprovedOn } from "@/lib/live";
import { readiness } from "@/lib/readiness";
import { courseProgress, lessonEntries, livePhase, nextOpenLesson, roomOpensAt, LIVE_LEAD_MIN } from "@/lib/learning";
import { lecturesIn, opensLesson, opensLive, planValue } from "@/lib/plans";
import { cheapestSku, discountPercent, effectivePrice } from "@/lib/pricing-engine";
import { alternates, siteUrl } from "@/lib/seo";
import { ProgressBar } from "@/components/ui/progress";
import { StatusChip } from "@/components/ui/StatusChip";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const course = await db.course.findUnique({
    where: { slug, published: true },
    select: { titleAr: true, titleEn: true, descAr: true, descEn: true },
  });
  if (!course) return {};
  const title = pick(locale === "ar", course.titleAr, course.titleEn);
  const description = pick(locale === "ar", course.descAr, course.descEn) || undefined;
  return {
    title,
    description,
    alternates: alternates(locale, `/courses/${slug}`),
    openGraph: { title, description, type: "article" },
  };
}

function Tick({ on }: { on: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={`mt-0.5 size-4 shrink-0 fill-none ${on ? "stroke-pen" : "stroke-field"}`} strokeWidth="2" strokeLinecap="round">
      <path d={on ? "M3 8.5l3 3 7-7" : "M4 8h8"} />
    </svg>
  );
}

type Line = { on: boolean; text: string };
type Offer = { id: string | null; label?: string; price: string; was?: string; notes: { text: string; good?: boolean }[] };

/** One plan as a card: what it includes, then each way to buy it with its price per lecture and saving. */
function PlanCard({ name, lines, offers, best, bestLabel, cta, className = "" }: { name: string; lines: Line[]; offers: Offer[]; best?: boolean; bestLabel: string; cta: string; className?: string }) {
  return (
    <li className={`card grid content-start gap-4 p-5 ${best ? "ring-2 ring-primary" : ""} ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-h3 font-bold">{name}</h3>
        {best && (
          <span className="shrink-0 rounded-full bg-marker px-2.5 py-0.5 font-display text-label font-bold text-ink">{bestLabel}</span>
        )}
      </div>
      <ul className="grid gap-2 text-small">
        {lines.map((l) => (
          <li key={l.text} className={`flex gap-2 ${l.on ? "" : "text-ink-muted"}`}>
            <Tick on={l.on} />
            {l.text}
          </li>
        ))}
      </ul>
      {offers.map((o) => (
        <div key={o.id ?? "pick"} className="grid gap-1.5 border-t border-dashed border-rule pt-3">
          {o.id && o.label && <span className="text-small font-semibold">{o.label}</span>}
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="num font-display text-h2 font-bold">{o.price}</span>
            {o.was && <s className="num text-small text-ink-muted">{o.was}</s>}
          </span>
          {o.notes.map((n) => (
            <span key={n.text} className={`text-small ${n.good ? "font-semibold text-up" : "text-ink-muted"}`}>
              {n.text}
            </span>
          ))}
          {o.id ? (
            <Link
              href={{ pathname: "/checkout", query: { sku: o.id } }}
              className={`btn mt-1 font-display ${best ? "btn-primary" : "btn-outline"}`}
            >
              {cta}
            </Link>
          ) : (
            <a href="#units" className="mt-1 text-small font-semibold text-pen underline underline-offset-4">
              {o.label}
            </a>
          )}
        </div>
      ))}
    </li>
  );
}

export default async function CoursePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const tp = await getTranslations("catalog.plans");
  const tl = await getTranslations("live");
  const th = await getTranslations("homework");
  const te = await getTranslations("exam");
  const tt = await getTranslations("teacher");
  const ar = locale === "ar";
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const now = new Date();

  const course = await db.course.findUnique({
    where: { slug, published: true },
    include: {
      grade: { include: { country: true } },
      liveSessions: { where: { cancelledAt: null, startsAt: { gt: new Date(now.getTime() - 5 * 3_600_000) } }, orderBy: { startsAt: "asc" }, include: { sku: true } },
      instructor: { select: { id: true, name: true, photoUrl: true, liveApproved: true } },
      units: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" }, include: { skus: { where: onSale(now) } } } },
      },
      skus: { where: { ...onSale(now), lessonId: null, liveSessionId: null }, orderBy: { price: "asc" } },
    },
  });
  if (!course) notFound();

  const session = await auth();
  void logEventLater({ name: "course_viewed", userId: session?.user?.id, courseId: course.id, dedupeScope: course.id });
  const staff = isCourseStaff(session?.user, course);
  const allGrants = await grantsFor(session?.user?.id, course.id, now, { includeEnded: true });
  const active = allGrants.filter((g) => !g.endsAt || g.endsAt > now);

  const lessonIds = course.units.flatMap((u) => u.lessons.map((l) => l.id));
  const homeworkCount = session?.user ? await db.assignment.count({ where: { courseId: course.id } }) : 0;
  const examCount = session?.user ? await db.examPaper.count({ where: { courseId: course.id, published: true } }) : 0;
  const [completedRows, currentView, attempts] = session?.user
    ? await Promise.all([
        db.lessonView.findMany({
          where: { userId: session.user.id, lessonId: { in: lessonIds }, completedAt: { not: null } },
          select: { lessonId: true, confidence: true, lastSeenAt: true },
        }),
        db.lessonView.findFirst({
          where: { userId: session.user.id, completedAt: null, lesson: { unit: { courseId: course.id } } },
          orderBy: { lastSeenAt: "desc" },
          select: { lessonId: true },
        }),
        db.practiceAttempt.findMany({
          where: { userId: session.user.id, lessonId: { in: lessonIds } },
          select: { lessonId: true, marks: true, maxMarks: true, createdAt: true },
        }),
      ])
    : [[], null, []];
  const completed = new Set(completedRows.map((v) => v.lessonId));


  const entries = lessonEntries(course.units);
  const scopeOf = (e: (typeof entries)[number]) => ({ id: e.lesson.id, month: e.lesson.month, term: e.term });
  const opens = (e: (typeof entries)[number]) => staff || e.isFree || active.some((g) => opensLesson(g, scopeOf(e), now));

  // Readiness is built only from what was actually recorded: finished lessons, practice marks,
  // the one-tap confidence answers, and when the student was last here.
  const ready =
    session?.user && !staff
      ? readiness({
          units: course.units.map((u) => ({
            id: u.id,
            title: ar ? u.titleAr : u.titleEn,
            lessonIds: lessonEntries([u]).filter(opens).map((e) => e.lesson.id),
          })),
          completed,
          confidence: new Map(completedRows.filter((r) => r.confidence).map((r) => [r.lessonId, r.confidence!] as const)),
          attempts,
          lastActivity: [...completedRows.map((r) => r.lastSeenAt), ...attempts.map((a) => a.createdAt)].reduce<Date | null>(
            (latest, d) => (!latest || d > latest ? d : latest),
            null,
          ),
          now,
        })
      : null;

  const paidEntries = entries.filter((e) => !e.isFree);  const openPaid = paidEntries.filter(opens).length;
  // A course with no paid lessons is not "owned" by everyone: only a real whole-course grant makes it full.
  const holdsWholeCourse = active.some((g) => !g.lessonId && !g.liveSessionId);
  const level: "full" | "partial" | "none" =
    staff || (openPaid === paidEntries.length && (paidEntries.length > 0 || holdsWholeCourse))
      ? "full"
      : openPaid > 0
        ? "partial"
        : "none";
  const lapsed =
    !staff && level === "none"
      ? allGrants.filter((g) => g.endsAt && g.endsAt <= now).sort((a, b) => (b.endsAt!.getTime() - a.endsAt!.getTime()))[0]
      : undefined;

  const plans = active.filter((g) => !g.lessonId && !g.liveSessionId);
  const bestPlan = plans.sort((a, b) => (b.endsAt?.getTime() ?? Number.POSITIVE_INFINITY) - (a.endsAt?.getTime() ?? Number.POSITIVE_INFINITY))[0];
  const progress = courseProgress(entries, active, completed, now);
  const next = nextOpenLesson(entries, active, completed, now);

  const single = cheapestSku(course.units.flatMap((u) => u.lessons.flatMap((l) => l.skus)), now);
  const singlePrice = single ? effectivePrice(single, now) : null;
  const months = course.skus.filter((s) => s.accessType === "MONTHLY").sort((a, b) => (a.month ?? 0) - (b.month ?? 0));
  const terms = course.skus.filter((s) => s.accessType === "SEMESTER").sort((a, b) => (a.term ?? 0) - (b.term ?? 0));
  const others = course.skus.filter((s) => s.accessType !== "MONTHLY" && s.accessType !== "SEMESTER");
  const offer = (s: (typeof course.skus)[number], label?: string): Offer => {
    const price = effectivePrice(s, now);
    const v = planValue(price, lecturesIn(course.units, s), singlePrice);
    const notes: Offer["notes"] = v ? [{ text: tp("perLecture", { price: formatMoney(v.perLecture, s.currency, locale) }) }] : [];
    if (v?.savePct && v.savePct > 0) notes.push({ text: tp("save", { pct: v.savePct }), good: true });
    const pct = discountPercent(s, now);
    if (pct !== null) notes.push({ text: t("percentOff", { pct }), good: true });
    return { id: s.id, label, price: formatMoney(price, s.currency, locale), was: pct !== null ? formatMoney(s.price, s.currency, locale) : undefined, notes };
  };
  const zone = courseZone(course);
  const lessonHref = (id: string) => `/courses/${course.slug}/lessons/${id}`;
  // Live is offered only for a teacher an admin approved for it.
  const live = liveApprovedOn(course)
    ? course.liveSessions.filter((l) => l.startsAt.getTime() + l.durationMin * 60_000 > now.getTime())
    : [];
  const courseTitle = pick(ar, course.titleAr, course.titleEn);
  const courseUrl = `${siteUrl}/${locale}/courses/${course.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: courseTitle,
    description: (ar ? course.descAr : course.descEn) ?? undefined,
    provider: { "@type": "Organization", name: ar ? "ذروة" : "Dhirwa", sameAs: siteUrl },
    url: courseUrl,
    offers: course.skus.map((s) => ({
      "@type": "Offer",
      price: (effectivePrice(s, now) / minorPerUnit(s.currency)).toFixed(minorPerUnit(s.currency) === 1000 ? 3 : 2),
      priceCurrency: s.currency,
      availability: "https://schema.org/InStock",
      url: courseUrl,
    })),
  };

  // Partial subscribers only see the plans that would actually open more of this course.
  const upgrades = level === "partial" ? course.skus.filter((s) => lecturesIn(course.units, s) > openPaid) : [];
  const showPlans = level === "none" || (level === "partial" && upgrades.length === 0);

  // The course wears its country's trail colour; skill courses have no country and use the trail green.
  const line = course.grade ? `var(--color-line-${course.grade.country.code.toLowerCase()}, var(--color-primary))` : "var(--color-primary)";
  // The one buy call in the header: only for someone who holds nothing yet and has a plan to pick.
  // Bahrain's red is too light for white; it carries ink (as on the map).
  const inkOnLine = course.grade?.country.code === "BH";
  const buyFrom = showPlans && level === "none" && !lapsed ? cheapestSku(single ? [...course.skus, single] : course.skus, now) : null;
  const headline = pick(ar, course.headlineAr, course.headlineEn);
  const desc = pick(ar, course.descAr, course.descEn);

  return (
    <main className="mx-auto grid max-w-3xl gap-10 px-4 py-12">
      <JsonLd data={jsonLd} />

      <header className="card overflow-hidden">
        {course.coverKey && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/covers/${course.id}?v=${course.coverKey.split("/").pop()}`} alt="" className="aspect-[16/9] w-full object-cover" />
        )}
        {/* The course's trail over a contour line. Not mirrored: a map is never flipped. */}
        <svg aria-hidden="true" viewBox="0 0 400 24" preserveAspectRatio="none" className={`h-6 w-full ${course.coverKey ? "-mt-3" : ""}`}>
          <g fill="none" strokeLinecap="round">
            {!course.coverKey && (
              <path d="M0 10C80 9 150 3 230 4S340 10 400 7" className="stroke-contour-4" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
            )}
            <path d="M0 20C70 19 130 12 200 10S330 4 400 3" strokeWidth="3" vectorEffect="non-scaling-stroke" style={{ stroke: line }} />
          </g>
        </svg>
        <div className="grid gap-4 px-5 pb-6 sm:px-8 sm:pb-8">
          <Link href="/courses" className="inline-flex min-h-11 w-fit items-center gap-2 text-small text-pen underline-offset-4 hover:underline">
            <Arrow aria-hidden="true" className="size-4 rotate-180" />
            {t("title")}
          </Link>
          <div className="grid gap-2">
            <p className="flex items-center gap-2 text-small font-medium text-ink-muted">
              <i aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: line }} />
              {course.grade ? pick(ar, course.grade.nameAr, course.grade.nameEn) : t("skill")}
            </p>
            <h1 className="font-display text-display font-bold">{courseTitle}</h1>
            {headline && <p className="max-w-[65ch] text-h3 font-semibold">{headline}</p>}
            {desc && <p className="max-w-[65ch] text-ink-muted">{desc}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {staff ? (
              <StatusChip tone="neutral">{session?.user?.role === "ADMIN" ? t("adminView") : t("staffView")}</StatusChip>
            ) : level === "full" ? (
              <StatusChip tone="active">{t("owned")}</StatusChip>
            ) : (
              bestPlan && (
                <StatusChip tone={bestPlan.endsAt && bestPlan.endsAt.getTime() - now.getTime() <= 7 * 86_400_000 ? "expiring" : "active"}>
                  {bestPlan.accessType ? t(`planKind.${bestPlan.accessType}`) : t("owned")}
                </StatusChip>
              )
            )}
            {level !== "none" && !staff && next ? (
              <Link href={lessonHref(next.lesson.id)} className="btn btn-primary">
                {t("continueCourse")}
                <Arrow aria-hidden="true" className="size-5" strokeWidth={2.5} />
              </Link>
            ) : lapsed ? (
              <Link href="#packages" className="btn btn-primary">
                {t("planPanel.renew")}
                <Arrow aria-hidden="true" className="size-5" strokeWidth={2.5} />
              </Link>
            ) : buyFrom ? (
              <>
                <Link href="#packages" className="btn btn-primary font-display">
                  {t("subscribe")}
                  <Arrow aria-hidden="true" className="size-5" strokeWidth={2.5} />
                </Link>
                <span className="flex items-baseline gap-2">
                  <span className="text-small text-ink-muted">{t("from")}</span>
                  <span className="num font-display text-h3 font-bold">{formatMoney(effectivePrice(buyFrom, now), buyFrom.currency, locale)}</span>
                </span>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {(bestPlan || lapsed || staff) && (
        <section className="grid gap-2 rounded-lg bg-raised p-4 text-small">
          <span className="font-display font-semibold">{t("planPanel.yourPlan")}</span>
          {staff ? (
            <span className="text-ink-muted">{t("staffView")}</span>
          ) : bestPlan ? (
            <>
              <span>
                {bestPlan.accessType ? t(`planKind.${bestPlan.accessType}`) : t("owned")} ·{" "}
                {t("planPanel.opens", { open: openPaid, total: paidEntries.length })}
              </span>
              <span className="text-ink-muted">
                {bestPlan.endsAt ? t("planPanel.ends", { date: formatDate(bestPlan.endsAt, zone, locale) }) : t("planPanel.noEnd")}
              </span>
            </>
          ) : (
            <>
              <StatusChip tone="expired">
                {t("planPanel.expired", { date: formatDate(lapsed!.endsAt!, zone, locale) })}
              </StatusChip>
              <Link href="#packages" className="w-fit text-pen underline underline-offset-4">
                {t("planPanel.renew")}
                <Arrow aria-hidden="true" className="size-5" strokeWidth={2.5} />
              </Link>
            </>
          )}
          {level === "partial" && openPaid < paidEntries.length && (
            <span className="text-ink-muted">{t("planPanel.outside", { count: paidEntries.length - openPaid })}</span>
          )}
        </section>
      )}

      {session?.user && !staff && level !== "none" && progress.total > 0 && (
        <ProgressBar done={progress.done} total={progress.total} label={t("progressLabel")} />
      )}

      {ready && (
        <section className="card grid gap-2 p-4" aria-label={t("readiness.title")} data-readiness={ready.score}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-display text-h3 font-bold">{t("readiness.title")}</span>
            <span className="font-display text-h2 font-bold num">
              {ready.score}
              <span className="text-small font-normal text-ink-muted">/100</span>
            </span>
          </div>
          {ready.capped ? (
            <p className="text-small text-ink-muted">{t("readiness.noPractice")}</p>
          ) : ready.gap?.kind === "accuracy" ? (
            <p className="text-small text-ink-muted">
              {t("readiness.gapAccuracy", { unit: ready.gap.title, percent: Math.round(ready.gap.accuracy * 100) })}
            </p>
          ) : ready.gap?.kind === "unfinished" ? (
            <p className="text-small text-ink-muted">
              {t("readiness.gapUnfinished", { unit: ready.gap.title, count: ready.gap.remaining })}
            </p>
          ) : (
            <p className="text-small text-ink-muted">{t("readiness.allGood")}</p>
          )}
        </section>
      )}

      {homeworkCount > 0 && (
        <section className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <span className="font-display text-h3 font-bold">{th("title")}</span>
          <span className="flex items-center gap-3 text-small">
            <span className="num text-ink-muted">{homeworkCount}</span>
            <Link href={`/courses/${slug}/assignments`} className="font-semibold text-pen underline underline-offset-4">
              {th("title")}
            </Link>
          </span>
        </section>
      )}

      {examCount > 0 && (
        <section className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <span className="font-display text-h3 font-bold">{te("title")}</span>
          <span className="flex items-center gap-3 text-small">
            <span className="num text-ink-muted">{examCount}</span>
            <Link href={`/courses/${slug}/exams`} className="font-semibold text-pen underline underline-offset-4">
              {te("title")}
            </Link>
          </span>
        </section>
      )}

      <section id="units" className="grid scroll-mt-6 gap-4">
        <h2 className="font-display text-h2 font-bold">{t("units")}</h2>
        {course.units.length === 0 && (
          <EmptyState>
            <p className="text-ink-muted">{t("noUnits")}</p>
          </EmptyState>
        )}
        {/* The units as waypoints up one trail in the course's colour, ending at the summit point. */}
        <ol className="grid">
          {course.units.map((u, i) => {
            const unitEntries = u.lessons.map((l) => ({ lesson: l, term: u.term, isFree: u.isFree }));
            const done = u.lessons.filter((l) => completed.has(l.id)).length;
            const hasCurrent = u.lessons.some((l) => l.id === currentView?.lessonId);
            const cleared = u.lessons.length > 0 && done === u.lessons.length;
            const last = i === course.units.length - 1;
            return (
              <li key={u.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 sm:gap-x-4">
                <span aria-hidden="true" className="flex flex-col items-center pt-3">
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-full border-4 font-display text-small font-bold ${cleared ? (inkOnLine ? "text-ink" : "text-on-primary") : "bg-surface"}`}
                    style={{ borderColor: line, background: cleared ? line : undefined }}
                  >
                    {cleared ? <Check className="size-5" strokeWidth={3} /> : <span className="num">{i + 1}</span>}
                  </span>
                  <i className="w-1 flex-1 rounded-full" style={{ background: line }} />
                  {last && <i className="mb-4 size-4 shrink-0 rounded-full bg-summit shadow-glow" />}
                </span>
                <details open={hasCurrent || (u === course.units[0] && !currentView)} className="card mb-4 overflow-hidden">
                  <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-3 p-4">
                    <span className="font-display text-h3 font-bold">{pick(ar, u.titleAr, u.titleEn)}</span>
                    <span className="num text-label text-ink-muted">{t("unitCount", { done, total: u.lessons.length })}</span>
                  </summary>
                  <ul className="px-2 pb-2">
                    {u.lessons.map((l) => {
                      const entry = unitEntries.find((e) => e.lesson.id === l.id)!;
                      const open = opens(entry);
                      const done = completed.has(l.id);
                      const rent = cheapestSku(l.skus, now);
                      const state = done ? "done" : currentView?.lessonId === l.id ? "current" : open ? "open" : level !== "none" ? "lockedPlan" : "locked";
                      return (
                        <li key={l.id}>
                          <LessonRow
                            href={open ? lessonHref(l.id) : undefined}
                            title={ar ? l.titleAr : l.titleEn}
                            subtitle={t(`kind.${l.kind}`)}
                            state={state}
                            trailing={
                              open ? null : level !== "none" ? (
                                <span className="text-label text-ink-muted">{t("outsidePlan")}</span>
                              ) : rent ? (
                                <Link href={{ pathname: "/checkout", query: { sku: rent.id } }} className="btn btn-outline px-3 py-1.5 text-small">
                                  {t("rent")} · <span className="num">{formatMoney(effectivePrice(rent, now), rent.currency, locale)}</span>
                                </Link>
                              ) : (
                                <span className="text-label">{t("liveSubscribers")}</span>
                              )
                            }
                          />
                        </li>
                      );
                    })}
                  </ul>
                </details>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-bold">{t("aboutTeacher")}</h2>
        <Link href={`/teachers/${course.instructor.id}`} className="card flex items-center gap-4 p-4 hover-lift">
          {course.instructor.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/avatars/${course.instructor.id}`} alt="" className="size-14 shrink-0 rounded-full object-cover ring-2 ring-hairline" />
          ) : (
            <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-full bg-raised font-display text-h3 font-bold">
              {course.instructor.name.trim().charAt(0)}
            </span>
          )}
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="font-display text-h3 font-bold">{course.instructor.name}</span>
            <span className="text-small text-pen">{tt("publicProfile")}</span>
          </span>
          <Arrow aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
        </Link>
      </section>

      {live.length > 0 && (
        <section id="live" className="grid scroll-mt-6 gap-4">
          <h2 className="font-display text-h2 font-bold">{t("live")}</h2>
          <ul className="grid gap-3">
            {live.map((l) => {
              const seat = l.sku?.active && (!l.sku.saleTo || l.sku.saleTo > now) ? l.sku : null;
              const canJoin = staff || active.some((g) => opensLive(g, l.id, now));
              const phase = livePhase(l.startsAt, l.durationMin, now);
              const opensNow = canJoin && roomOpensAt(l.startsAt, LIVE_LEAD_MIN.student) <= now;
              const minutes = Math.max(1, Math.round((l.startsAt.getTime() - now.getTime()) / 60_000));
              return (
                <li key={l.id}>
                  <LiveRow
                    href={canJoin ? `/live/${l.id}` : undefined}
                    title={ar ? l.titleAr : l.titleEn}
                    when={formatWhen(l.startsAt, zone, locale)}
                    phase={phase === "ended" ? "later" : phase}
                    phaseLabel={phase === "now" ? tl("liveNow") : phase === "soon" ? tl("startsSoon", { minutes }) : tl("later")}
                    action={
                      opensNow ? (
                        <Link href={`/live/${l.id}`} className="btn btn-outline px-3 py-1.5 text-small">
                          {tl("joinNow")}
                        </Link>
                      ) : canJoin ? (
                        <span className="text-up">{t("liveIncluded")}</span>
                      ) : seat ? (
                        <Link href={{ pathname: "/checkout", query: { sku: seat.id } }} className="btn btn-outline px-3 py-1.5 text-small">
                          {t("liveSeat")} · <span className="num">{formatMoney(effectivePrice(seat, now), seat.currency, locale)}</span>
                        </Link>
                      ) : (
                        <span className="text-ink-muted">{t("liveSubscribers")}</span>
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {level === "partial" && upgrades.length > 0 && (
        <section id="packages" className="grid scroll-mt-6 gap-4">
          <h2 className="font-display text-h2 font-bold">{t("upgradeTitle")}</h2>
          <ul className="grid gap-3">
            {upgrades.map((s) => (
              <li key={s.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="grid gap-1">
                  <span className="font-display font-semibold">{t(`planKind.${s.accessType}`)}</span>
                  <span className="text-small text-ink-muted">
                    {t("planPanel.opens", { open: lecturesIn(course.units, s), total: paidEntries.length })}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="num font-semibold">{formatMoney(effectivePrice(s, now), s.currency, locale)}</span>
                  <Link href={{ pathname: "/checkout", query: { sku: s.id } }} className="btn btn-outline px-3 py-1.5 text-small">
                    {t("upgrade")}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showPlans && (single || months.length > 0 || terms.length > 0) && (
        <section id="packages" className="grid scroll-mt-6 gap-4">
          <h2 className="font-display text-h2 font-bold">{lapsed ? t("renewTitle") : tp("title")}</h2>
          <ul className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
            {single && (
              <PlanCard
                name={tp("SINGLE")}
                lines={[
                  { on: true, text: tp("singleIncl", { days: single.accessDays ?? 0 }) },
                  { on: false, text: tp("liveNo") },
                  { on: false, text: tp("askNo") },
                ]}
                offers={[
                  {
                    id: null,
                    label: tp("pickLecture"),
                    price: singlePrice != null ? formatMoney(singlePrice, single.currency, locale) : "",
                    was: discountPercent(single, now) !== null ? formatMoney(single.price, single.currency, locale) : undefined,
                    notes: [],
                  },
                ]}
                bestLabel={tp("bestValue")}
                cta={t("subscribe")}
              />
            )}
            {months.length > 0 && (
              <PlanCard
                name={tp("MONTHLY")}
                lines={[
                  { on: true, text: tp("monthIncl", { count: lecturesIn(course.units, months[0]), days: months[0].accessDays ?? 30 }) },
                  { on: false, text: tp("liveNo") },
                  { on: true, text: tp("askYes") },
                ]}
                offers={months.map((s) => offer(s, s.month ? tp("monthN", { n: s.month }) : undefined))}
                bestLabel={tp("bestValue")}
                cta={t("subscribe")}
              />
            )}
            {terms.length > 0 && (
              <PlanCard
                name={tp("SEMESTER")}
                lines={[
                  { on: true, text: paidEntries.length === 0 ? tp("wholeCourseIncl") : tp("semesterIncl", { count: lecturesIn(course.units, terms[0]) }) },
                  { on: true, text: tp("liveYes") },
                  { on: true, text: tp("askYes") },
                ]}
                offers={terms.map((s) => offer(s, s.term ? tp("termN", { n: s.term }) : undefined))}
                best
                bestLabel={tp("bestValue")}
                cta={t("subscribe")}
                className="order-first sm:order-none"
              />
            )}
          </ul>
        </section>
      )}

      {level === "none" && !lapsed && !single && months.length === 0 && terms.length === 0 && (
        <section className="grid gap-2">
          <h2 className="font-display text-h2 font-bold">{tp("title")}</h2>
          <p className="text-ink-muted">{t("noPackages")}</p>
        </section>
      )}

      {level === "none" && others.length > 0 && (
        <section id={single || months.length > 0 || terms.length > 0 ? undefined : "packages"} className="grid scroll-mt-6 gap-4">
          <h2 className="font-display text-h2 font-bold">{tp("other")}</h2>
          <ul className="grid gap-3">
            {others.map((s) => (
              <li key={s.id} className="card flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="grid gap-1">
                  <span className="font-display font-semibold">{t(`access.${s.accessType}`, { days: s.accessDays ?? 0 })}</span>
                  {s.accessEndsAt && <span className="text-small text-ink-muted">{t("until", { date: formatDate(s.accessEndsAt, zone, locale) })}</span>}
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex items-baseline gap-2">
                    {discountPercent(s, now) !== null && <s className="num text-small text-ink-muted">{formatMoney(s.price, s.currency, locale)}</s>}
                    <span className="num text-h3 font-semibold">{formatMoney(effectivePrice(s, now), s.currency, locale)}</span>
                  </span>
                  <Link
                    href={{ pathname: "/checkout", query: { sku: s.id } }}
                    className="btn btn-outline font-display"
                  >
                    {t("subscribe")}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

