import type { Metadata } from "next";
import { cache } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { logEventLater } from "@/lib/analytics";
import { filterUnits } from "@/lib/arabic-search";
import { EmptyState } from "@/components/brand/Mark";
import { JsonLd } from "@/components/JsonLd";
import { LiveRow } from "@/components/learning/LiveRow";
import { LessonRow } from "@/components/learning/LessonRow";
import { Link } from "@/i18n/navigation";
import { grantsFor, isCourseStaff, onSale } from "@/lib/catalog";
import { pick } from "@/lib/content";
import { db } from "@/lib/db";
import { courseZone, formatDate, formatMoney, formatWhen, minorPerUnit } from "@/lib/format";
import { canCharge } from "@/lib/gateway";
import { formatRate } from "@/lib/fx";
import { liveApprovedOn } from "@/lib/live";
import { readiness } from "@/lib/readiness";
import { isLocked } from "@/lib/gate";
import { itemHref, loadGate } from "@/lib/gate-data";
import { courseRatings, rateState } from "@/lib/reviews";
import { ReviewForm } from "./reviews/ReviewForm";
import { courseProgress, lessonEntries, livePhase, nextOpenLesson, roomOpensAt, LIVE_LEAD_MIN } from "@/lib/learning";
import { lecturesIn, opensLesson, opensLive, planValue } from "@/lib/plans";
import { aedPriceOf, cheapestSku, discountPercent, effectivePrice } from "@/lib/pricing-engine";
import { alternates, siteUrl } from "@/lib/seo";
import { ProgressBar } from "@/components/ui/progress";
import { StatusChip } from "@/components/ui/StatusChip";

export const dynamic = "force-dynamic";

/** generateMetadata and the page share one query per request instead of hitting the database twice. */
const getCourse = cache((slug: string) => {
  const at = new Date();
  return db.course.findUnique({
    where: { slug, published: true },
    include: {
      grade: { include: { country: true } },
      liveSessions: { where: { cancelledAt: null, startsAt: { gt: new Date(at.getTime() - 5 * 3_600_000) } }, orderBy: { startsAt: "asc" }, include: { sku: true } },
      instructor: { select: { id: true, name: true, photoUrl: true, liveApproved: true } },
      units: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" }, include: { skus: { where: onSale(at) } } } },
      },
      skus: { where: { ...onSale(at), lessonId: null, liveSessionId: null }, orderBy: { price: "asc" } },
    },
  });
});

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const course = await getCourse(slug);
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
          <span className="shrink-0 rounded-full bg-marker px-2.5 py-0.5 font-display text-label font-bold text-on-summit">{bestLabel}</span>
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
        <div key={o.id ?? "pick"} className="grid gap-1.5 border-t border-hairline pt-3">
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

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale, slug } = await params;
  const q = (await searchParams).q?.trim() ?? "";
  setRequestLocale(locale);
  const t = await getTranslations("catalog");
  const tcommon = await getTranslations("common");
  const tp = await getTranslations("catalog.plans");
  const tl = await getTranslations("live");
  const th = await getTranslations("homework");
  const te = await getTranslations("exam");
  const tt = await getTranslations("teacher");
  const tg = await getTranslations("gate");
  const tr = await getTranslations("reviews");
  const ar = locale === "ar";
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const now = new Date();

  const course = await getCourse(slug);
  if (!course) notFound();

  // The market the course is sold in. Its local currency is the display; AED is the charge.
  const countryCurrency = course.grade?.country.currency ?? "AED";
  const fxRow =
    countryCurrency !== "AED"
      ? await db.fxRate.findUnique({ where: { currency: countryCurrency }, select: { aedPerUnit: true } })
      : null;
  const fxRate = fxRow ? Number(fxRow.aedPerUnit) : null;

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

  // Mandatory homework and exams: the lessons after unfinished required work are closed. Staff see everything.
  const gate = session?.user && !staff ? await loadGate(session.user.id, course.id, now) : null;
  const closedByWork = (lessonId: string) => !!gate && isLocked(gate.entries, gate.blocker, lessonId);

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
            title: pick(ar, u.titleAr, u.titleEn),
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
  const rating = (await courseRatings([course.id])).get(course.id);
  const rate = session?.user && !staff && session.user.role === "STUDENT" ? await rateState(session.user.id, course.id, now) : null;
  const nextRaw = nextOpenLesson(entries, active, completed, now);
  const next = nextRaw && !closedByWork(nextRaw.lesson.id) ? nextRaw : undefined;

  const single = cheapestSku(course.units.flatMap((u) => u.lessons.flatMap((l) => l.skus)), now);
  const singlePrice = single ? effectivePrice(single, now) : null;
  const months = course.skus.filter((s) => s.accessType === "MONTHLY").sort((a, b) => (a.month ?? 0) - (b.month ?? 0));
  const terms = course.skus.filter((s) => s.accessType === "SEMESTER").sort((a, b) => (a.term ?? 0) - (b.term ?? 0));

  // "Best value" is computed from the real per-lecture price, never asserted. The cheapest plan among
  // the ones actually on offer earns the badge.
  const perLectureOf = (sku: NonNullable<typeof single>) => effectivePrice(sku, now) / Math.max(1, lecturesIn(course.units, sku));
  const planOptions = [
    { kind: "SINGLE" as const, sku: single },
    { kind: "MONTHLY" as const, sku: months[0] },
    { kind: "SEMESTER" as const, sku: terms[0] },
  ].filter((o): o is { kind: "SINGLE" | "MONTHLY" | "SEMESTER"; sku: NonNullable<typeof single> } => Boolean(o.sku));
  const bestKind = [...planOptions].sort((a, b) => perLectureOf(a.sku) - perLectureOf(b.sku))[0]?.kind;

  // The free first unit is the strongest risk reversal the product has; it must be reachable in one click.
  const freeEntry = entries.find((e) => e.isFree) ?? null;
  const others = course.skus.filter((s) => s.accessType !== "MONTHLY" && s.accessType !== "SEMESTER");
  const offer = (s: (typeof course.skus)[number], label?: string): Offer => {
    const price = effectivePrice(s, now);
    const v = planValue(price, lecturesIn(course.units, s), singlePrice);
    const notes: Offer["notes"] = v ? [{ text: tp("perLecture", { price: formatMoney(v.perLecture, s.currency, locale) }) }] : [];
    if (v?.savePct && v.savePct > 0) notes.push({ text: tp("save", { pct: v.savePct }), good: true });
    const pct = discountPercent(s, now);
    if (pct !== null) notes.push({ text: t("percentOff", { pct }), good: true });
    const aed = aedPriceOf(s, now);
    if (aed == null || !canCharge("AED")) notes.push({ text: t("paySoon") });
    else if (aed !== price) notes.push({ text: t("chargedInAed", { price: formatMoney(aed, "AED", locale) }) });
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
    description: (pick(ar, course.descAr, course.descEn)) ?? undefined,
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
  const buyFrom = showPlans && level === "none" && !lapsed ? cheapestSku(single ? [...course.skus, single] : course.skus, now) : null;
  const buyAed = buyFrom ? aedPriceOf(buyFrom, now) : null;
  const headline = pick(ar, course.headlineAr, course.headlineEn);
  const desc = pick(ar, course.descAr, course.descEn);

  // Scoped search: a course can hold hundreds of lessons, so narrow the trail to the units and
  // lessons that match. A unit whose own title matches keeps all of its lessons.
  const shownUnits = q.length < 2 ? course.units.map((u) => ({ unit: u, lessons: u.lessons })) : filterUnits(course.units, q);

  return (
    <main className="mx-auto grid max-w-4xl gap-12 px-4 py-10 md:py-16">
      <JsonLd data={jsonLd} />

      <header className="grid gap-6">
        {course.coverKey && (
          <span className="relative block aspect-[16/9] w-full overflow-hidden rounded-lg">
            <Image src={`/api/covers/${course.id}?v=${course.coverKey.split("/").pop()}`} alt="" fill priority sizes="(min-width: 896px) 896px, 100vw" className="object-cover" />
          </span>
        )}
        <div className="grid gap-4">
          <Link href="/courses" className="inline-flex min-h-11 w-fit items-center gap-2 text-small text-ink-muted underline-offset-4 hover:underline">
            <Arrow aria-hidden="true" className="size-4 rotate-180" />
            {t("title")}
          </Link>
          <div className="grid gap-2">
            <p className="flex items-center gap-2 text-small font-medium text-ink-muted">
              <i aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: line }} />
              {course.grade ? pick(ar, course.grade.nameAr, course.grade.nameEn) : t("skill")}
            </p>
            <h1 className="font-display text-display leading-[1.15] font-bold">{courseTitle}</h1>
            {headline && <p className="max-w-[65ch] text-lede font-medium">{headline}</p>}
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
                {freeEntry && (
                  <Link href={lessonHref(freeEntry.lesson.id)} className="btn btn-outline font-display">
                    {t("tryFree")}
                  </Link>
                )}
                <span className="flex items-baseline gap-2">
                  <span className="text-small text-ink-muted">{t("from")}</span>
                  <span className="num font-display text-h3 font-bold">{formatMoney(effectivePrice(buyFrom, now), buyFrom.currency, locale)}</span>
                  {buyAed != null && buyAed !== effectivePrice(buyFrom, now) && (
                    <span className="text-label text-ink-muted">{t("chargedInAed", { price: formatMoney(buyAed, "AED", locale) })}</span>
                  )}
                  {buyAed == null && <span className="text-label text-ink-muted">{t("paySoon")}</span>}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {countryCurrency !== "AED" && (
        <p className="rounded-lg bg-raised p-3 text-small text-ink-muted">
          {fxRate != null
            ? t("conversionNoticeRate", { currency: countryCurrency, rate: formatRate(fxRate, locale) })
            : t("conversionNotice", { currency: countryCurrency })}
        </p>
      )}

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

      {gate?.blocker && (
        <section className="card flex flex-wrap items-center justify-between gap-3 border-pen p-4">
          <span className="grid gap-0.5">
            <span className="font-display text-h3 font-bold">{tg("courseBannerTitle")}</span>
            <span className="text-small text-ink-muted" dir="auto">{tg(gate.blocker.item.kind === "exam" ? "finishExam" : "finishHomework", { title: gate.blocker.item.title })}</span>
          </span>
          <Link href={itemHref(slug, gate.blocker.item)} className="btn btn-primary">{tg("go")}</Link>
        </section>
      )}

      {(rating || rate?.eligible || rate?.mine) && (
        <section id="rate" className="card grid gap-3 p-4">
          <span className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-display text-h3 font-bold">{rate?.eligible ? tr("title") : tr("ratingTitle")}</span>
            {rating && <span className="num text-small text-ink-muted">{tr("ratingLine", { avg: String(rating.avg), count: String(rating.count) })}</span>}
          </span>
          {rate?.eligible && (!rate.mine || rate.mine.status === "HELD") && (
            <>
              <p className="text-small text-ink-muted">{tr("hint")}</p>
              <ReviewForm
                courseId={course.id}
                initial={rate.mine}
                labels={{ stars: tr("stars"), text: tr("text"), send: tr("send"), ok: tr("ok"), held: tr("held"), closed: tr("closed"), masked: tr("masked"), invalid: tr("invalid"), already: tr("already") }}
              />
            </>
          )}
          {rate?.mine && rate.mine.status !== "HELD" && (
            <p className="text-small text-ink-muted">{tr(rate.mine.status === "PUBLISHED" ? "yours" : "removed", { stars: String(rate.mine.stars) })}</p>
          )}
          {rate?.mine?.status === "HELD" && <p className="text-small text-ink-muted">{tr("waiting")}</p>}
        </section>
      )}

      {homeworkCount > 0 && (
        <section className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <span className="font-display text-h3 font-bold">{th("sectionTitle")}</span>
          <span className="flex items-center gap-3 text-small">
            <span className="num text-ink-muted">{homeworkCount}</span>
            <Link href={`/courses/${slug}/assignments`} className="link-tap font-semibold text-pen underline underline-offset-4">
              {th("open")}
            </Link>
          </span>
        </section>
      )}

      {examCount > 0 && (
        <section className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <span className="font-display text-h3 font-bold">{te("title")}</span>
          <span className="flex items-center gap-3 text-small">
            <span className="num text-ink-muted">{examCount}</span>
            <Link href={`/courses/${slug}/exams`} className="link-tap font-semibold text-pen underline underline-offset-4">
              {te("title")}
            </Link>
          </span>
        </section>
      )}

      <section id="units" className="grid gap-4">
        <h2 className="font-display text-h2 font-bold">{t("units")}</h2>
        <form method="get" role="search" className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            minLength={2}
            maxLength={80}
            placeholder={t("lessonSearchPlaceholder")}
            aria-label={t("lessonSearchPlaceholder")}
            className="min-h-11 min-w-0 flex-1 rounded-full border border-field bg-surface px-5 text-body text-ink"
          />
          <button className="btn btn-primary font-display">{tcommon("search")}</button>
        </form>
        {shownUnits.length === 0 && (
          <EmptyState>
            <p className="text-ink-muted">{q.length >= 2 ? tcommon("searchNoMatch") : t("noUnits")}</p>
          </EmptyState>
        )}
        {/* The units as waypoints up one trail in the course's colour, ending at the summit point. */}
        <ol className="grid">
          {shownUnits.map(({ unit: u, lessons }, i) => {
            const unitEntries = lessons.map((l) => ({ lesson: l, term: u.term, isFree: u.isFree }));
            const done = lessons.filter((l) => completed.has(l.id)).length;
            const hasCurrent = lessons.some((l) => l.id === currentView?.lessonId);
            const cleared = lessons.length > 0 && done === lessons.length;
            return (
              <li key={u.id}>
                <details open={q.length >= 2 || hasCurrent || (shownUnits[0]?.unit === u && !currentView)} className="card overflow-hidden">
                  <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-3 p-4">
                    <span className="flex flex-wrap items-center gap-3">
                      <span aria-hidden="true" className={`num grid size-8 shrink-0 place-items-center rounded-full text-small font-semibold ${cleared ? "bg-summit text-on-summit" : "bg-raised text-ink-muted"}`}>
                        {cleared ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                      </span>
                      <span className="font-display text-h3 font-bold">{pick(ar, u.titleAr, u.titleEn)}</span>
                      {u.isFree && (
                        <span className="rounded-full bg-marker px-2 py-0.5 font-display text-label font-bold text-on-summit">{t("freeUnit")}</span>
                      )}
                    </span>
                    <span className="num text-label text-ink-muted">{t("unitCount", { done, total: lessons.length })}</span>
                  </summary>
                  <ul className="px-2 pb-2">
                    {lessons.map((l) => {
                      const entry = unitEntries.find((e) => e.lesson.id === l.id)!;
                      const open = opens(entry);
                      const done = completed.has(l.id);
                      const rent = cheapestSku(l.skus, now);
                      const rentAed = rent ? aedPriceOf(rent, now) : null;
                      const closed = open && closedByWork(l.id);
                      const state = closed ? "locked" : done ? "done" : currentView?.lessonId === l.id ? "current" : open ? "open" : level !== "none" ? "lockedPlan" : "locked";
                      return (
                        <li key={l.id}>
                          <LessonRow
                            href={open && !closed ? lessonHref(l.id) : undefined}
                            title={pick(ar, l.titleAr, l.titleEn)}
                            subtitle={u.isFree ? `${t(`kind.${l.kind}`)} · ${t("freeLesson")}` : t(`kind.${l.kind}`)}
                            state={state}
                            stateLabel={state === "done" ? t("lessonState.done") : state === "current" ? t("lessonState.current") : state === "open" ? t("lessonState.ahead") : undefined}
                            trailing={
                              closed ? (
                                <span className="text-label text-ink-muted">{tg("lockedRow")}</span>
                              ) : open ? null : level !== "none" ? (
                                <span className="text-label text-ink-muted">{t("outsidePlan")}</span>
                              ) : rent ? (
                                <span className="grid justify-items-end gap-0.5">
                                  <Link href={{ pathname: "/checkout", query: { sku: rent.id } }} className="btn btn-outline px-3 py-1.5 text-small">
                                    {t("rent")} · <span className="num">{formatMoney(effectivePrice(rent, now), rent.currency, locale)}</span>
                                  </Link>
                                  {rentAed == null || !canCharge("AED") ? (
                                    <span className="text-label text-ink-muted">{t("paySoon")}</span>
                                  ) : rentAed !== effectivePrice(rent, now) ? (
                                    <span className="text-label text-ink-muted">{t("chargedInAed", { price: formatMoney(rentAed, "AED", locale) })}</span>
                                  ) : null}
                                </span>
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
        <section id="live" className="grid gap-4">
          <h2 className="font-display text-h2 font-bold">{t("live")}</h2>
          <ul className="grid gap-3">
            {live.map((l) => {
              const seat = l.sku?.active && (!l.sku.saleTo || l.sku.saleTo > now) ? l.sku : null;
              const seatAed = seat ? aedPriceOf(seat, now) : null;
              const canJoin = staff || active.some((g) => opensLive(g, l.id, now));
              const phase = livePhase(l.startsAt, l.durationMin, now);
              const opensNow = canJoin && roomOpensAt(l.startsAt, LIVE_LEAD_MIN.student) <= now;
              const minutes = Math.max(1, Math.round((l.startsAt.getTime() - now.getTime()) / 60_000));
              return (
                <li key={l.id}>
                  <LiveRow
                    href={canJoin ? `/live/${l.id}` : undefined}
                    title={pick(ar, l.titleAr, l.titleEn)}
                    when={formatWhen(l.startsAt, zone, locale)}
                    phase={phase === "ended" ? "later" : phase}
                    phaseLabel={phase === "now" ? tl("liveNow") : phase === "soon" ? tl("startsSoon", { minutes }) : tl("later")}
                    action={
                      opensNow ? (
                        <span className="btn btn-outline px-3 py-1.5 text-small">{tl("joinNow")}</span>
                      ) : canJoin ? (
                        <span className="text-up">{t("liveIncluded")}</span>
                      ) : seat ? (
                        <span className="grid justify-items-end gap-0.5">
                          <Link href={{ pathname: "/checkout", query: { sku: seat.id } }} className="btn btn-outline px-3 py-1.5 text-small">
                            {t("liveSeat")} · <span className="num">{formatMoney(effectivePrice(seat, now), seat.currency, locale)}</span>
                          </Link>
                          {seatAed == null || !canCharge("AED") ? (
                            <span className="text-label text-ink-muted">{t("paySoon")}</span>
                          ) : seatAed !== effectivePrice(seat, now) ? (
                            <span className="text-label text-ink-muted">{t("chargedInAed", { price: formatMoney(seatAed, "AED", locale) })}</span>
                          ) : null}
                        </span>
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
        <section id="packages" className="grid gap-4">
          <h2 className="font-display text-h2 font-bold">{t("upgradeTitle")}</h2>
          <ul className="grid gap-3">
            {upgrades.map((s) => {
              const aed = aedPriceOf(s, now);
              return (
              <li key={s.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="grid gap-1">
                  <span className="font-display font-semibold">{t(`planKind.${s.accessType}`)}</span>
                  <span className="text-small text-ink-muted">
                    {t("planPanel.opens", { open: lecturesIn(course.units, s), total: paidEntries.length })}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="grid justify-items-end gap-0.5">
                    <span className="num font-semibold">{formatMoney(effectivePrice(s, now), s.currency, locale)}</span>
                    {aed == null || !canCharge("AED") ? (
                      <span className="text-label text-ink-muted">{t("paySoon")}</span>
                    ) : aed !== effectivePrice(s, now) ? (
                      <span className="text-label text-ink-muted">{t("chargedInAed", { price: formatMoney(aed, "AED", locale) })}</span>
                    ) : null}
                  </span>
                  <Link href={{ pathname: "/checkout", query: { sku: s.id } }} className="btn btn-outline px-3 py-1.5 text-small">
                    {t("upgrade")}
                  </Link>
                </div>
              </li>
              );
            })}
          </ul>
        </section>
      )}

      {showPlans && (single || months.length > 0 || terms.length > 0) && (
        <section id="packages" className="grid gap-4">
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
                best={bestKind === "SINGLE"}
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
                best={bestKind === "MONTHLY"}
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
                best={bestKind === "SEMESTER"}
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
        <section id={single || months.length > 0 || terms.length > 0 ? undefined : "packages"} className="grid gap-4">
          <h2 className="font-display text-h2 font-bold">{tp("other")}</h2>
          <ul className="grid gap-3">
            {others.map((s) => {
              const aed = aedPriceOf(s, now);
              return (
              <li key={s.id} className="card flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="grid gap-1">
                  <span className="font-display font-semibold">{t(`access.${s.accessType}`, { days: s.accessDays ?? 0 })}</span>
                  {s.accessEndsAt && <span className="text-small text-ink-muted">{t("until", { date: formatDate(s.accessEndsAt, zone, locale) })}</span>}
                </div>
                <div className="flex items-center gap-4">
                  <span className="grid justify-items-end gap-0.5">
                    <span className="flex items-baseline gap-2">
                      {discountPercent(s, now) !== null && <s className="num text-small text-ink-muted">{formatMoney(s.price, s.currency, locale)}</s>}
                      <span className="num text-h3 font-semibold">{formatMoney(effectivePrice(s, now), s.currency, locale)}</span>
                    </span>
                    {aed == null || !canCharge("AED") ? (
                      <span className="text-label text-ink-muted">{t("paySoon")}</span>
                    ) : aed !== effectivePrice(s, now) ? (
                      <span className="text-label text-ink-muted">{t("chargedInAed", { price: formatMoney(aed, "AED", locale) })}</span>
                    ) : null}
                  </span>
                  <Link
                    href={{ pathname: "/checkout", query: { sku: s.id } }}
                    className="btn btn-outline font-display"
                  >
                    {t("subscribe")}
                  </Link>
                </div>
              </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}

