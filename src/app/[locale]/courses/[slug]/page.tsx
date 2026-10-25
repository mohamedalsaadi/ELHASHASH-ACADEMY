import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { CIRCLE_PATH, EmptyState } from "@/components/brand/Mark";
import { JsonLd } from "@/components/JsonLd";
import { Link } from "@/i18n/navigation";
import { grantsFor, onSale } from "@/lib/catalog";
import { db } from "@/lib/db";
import { courseZone, formatMoney, formatWhen, minorPerUnit } from "@/lib/format";
import { lecturesIn, opensLesson, opensLive, planValue } from "@/lib/plans";
import { cheapestSku, discountPercent, effectivePrice } from "@/lib/pricing-engine";
import { alternates, siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const course = await db.course.findUnique({
    where: { slug, published: true },
    select: { titleAr: true, titleEn: true, descAr: true, descEn: true },
  });
  if (!course) return {};
  const title = locale === "ar" ? course.titleAr : course.titleEn;
  const description = (locale === "ar" ? course.descAr : course.descEn) ?? undefined;
  return {
    title,
    description,
    alternates: alternates(locale, `/courses/${slug}`),
    openGraph: { title, description, type: "article" },
  };
}

function LockIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 fill-none stroke-current" strokeWidth="1.5">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
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
    <li className={`grid content-start gap-4 rounded-lg bg-surface p-5 ${best ? "border-strong border-ink shadow-paper" : "border border-hairline"} ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-h3 font-bold">{name}</h3>
        {best && (
          <span className="relative shrink-0 px-3.5 py-2 font-display text-label font-semibold">
            <svg viewBox="0 0 48 48" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 size-full overflow-visible">
              <path d={CIRCLE_PATH} fill="none" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="stroke-pen" />
            </svg>
            <span className="marker">{bestLabel}</span>
          </span>
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
            <span className="num font-display text-h2 font-extrabold">{o.price}</span>
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
              className={`mt-1 rounded-sm px-4 py-2.5 text-center font-display font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) ${best ? "bg-primary text-on-primary hover:bg-[color-mix(in_oklab,var(--color-primary)_86%,#fff)]" : "border-strong border-ink hover:bg-marker"}`}
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
  const ar = locale === "ar";
  const now = new Date();

  const course = await db.course.findUnique({
    where: { slug, published: true },
    include: {
      grade: { include: { country: true } },
      // Upcoming sessions; ones that started up to 5 hours ago are checked against their end below.
      liveSessions: { where: { cancelledAt: null, startsAt: { gt: new Date(now.getTime() - 5 * 3_600_000) } }, orderBy: { startsAt: "asc" }, include: { sku: true } },
      instructor: { select: { name: true } },
      units: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" }, include: { skus: { where: onSale(now), take: 1 }, instructor: { select: { name: true } } } } },
      },
      skus: { where: { ...onSale(now), lessonId: null, liveSessionId: null }, orderBy: { price: "asc" } },
    },
  });
  if (!course) notFound();

  const session = await auth();
  const grants = await grantsFor(session?.user?.id, course.id, now);
  const lessonIds = course.units.flatMap((u) => u.lessons.map((l) => l.id));
  const completed = session?.user
    ? await db.lessonView.count({ where: { userId: session.user.id, lessonId: { in: lessonIds }, completedAt: { not: null } } })
    : 0;
  const progressPct = lessonIds.length ? Math.round((completed / lessonIds.length) * 100) : 0;
  const opens = (l: { id: string; month: number | null }, term: number) => grants.some((g) => opensLesson(g, { id: l.id, month: l.month, term }, now));
  const paid = course.units.filter((u) => !u.isFree).flatMap((u) => u.lessons.map((l) => ({ l, term: u.term })));
  const owned = paid.length > 0 && paid.every(({ l, term }) => opens(l, term));
  const rentalOf = (id: string) => grants.find((g) => g.lessonId === id && g.startsAt <= now);

  // The three plans. The cheapest lecture rental is the single-lecture price every plan is compared with.
  const tp = await getTranslations("catalog.plans");
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
  const firstFree = course.units.find((u) => u.isFree)?.lessons[0];
  const date = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "long", timeZone: "Africa/Cairo" });
  const lessonHref = (id: string) => `/courses/${course.slug}/lessons/${id}`;
  const live = course.liveSessions.filter((l) => l.startsAt.getTime() + l.durationMin * 60_000 > now.getTime());
  const courseTitle = ar ? course.titleAr : course.titleEn;
  const courseUrl = `${siteUrl}/${locale}/courses/${course.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: courseTitle,
    description: (ar ? course.descAr : course.descEn) ?? undefined,
    provider: { "@type": "Organization", name: "AAcademy", sameAs: siteUrl },
    url: courseUrl,
    offers: course.skus.map((s) => ({
      "@type": "Offer",
      price: (effectivePrice(s, now) / minorPerUnit(s.currency)).toFixed(2),
      priceCurrency: s.currency,
      availability: "https://schema.org/InStock",
      url: courseUrl,
    })),
  };

  return (
    <main className="mx-auto grid max-w-3xl gap-10 px-4 py-12">
      <JsonLd data={jsonLd} />
      <section className="grid gap-3">
        <p className="text-small text-ink-muted">{course.grade ? (ar ? course.grade.nameAr : course.grade.nameEn) : t("skill")}</p>
        <h1 className="font-display text-h1 font-semibold text-balance">{ar ? course.titleAr : course.titleEn}</h1>
        {(ar ? course.descAr : course.descEn) && <p className="max-w-[65ch] text-ink-muted">{ar ? course.descAr : course.descEn}</p>}
        {session?.user && progressPct > 0 && (
          <p className="text-small text-ink-muted">{t("progress", { pct: progressPct, done: completed, total: lessonIds.length })}</p>
        )}
        {owned ? (
          <p className="w-fit rounded-full border border-up px-3 py-1 text-label text-up">{t("owned")}</p>
        ) : (
          firstFree && (
            <Link
              href={lessonHref(firstFree.id)}
              className="btn btn-primary w-fit"
            >
              {t("startFree")}
            </Link>
          )
        )}
      </section>

      <section id="units" className="grid scroll-mt-6 gap-4">
        <h2 className="font-display text-h2 font-semibold">{t("units")}</h2>
        {course.units.length === 0 && (
          <EmptyState>
            <p className="text-ink-muted">{t("noUnits")}</p>
          </EmptyState>
        )}
        {course.units.map((u) => {
          return (
            <div key={u.id} className="grid gap-2 rounded-md border border-hairline bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-h3 font-semibold">{ar ? u.titleAr : u.titleEn}</h3>
                {u.isFree && !owned && <span className="rounded-full border border-up px-3 py-1 text-label text-up">{t("free")}</span>}
              </div>
              <ul className="grid">
                {u.lessons.map((l) => {
                  const open = u.isFree || opens(l, u.term);
                  const rental = rentalOf(l.id);
                  const rented = !!rental;
                  const until = rental?.endsAt;
                  const rent = l.skus[0];
                  const label = (
                    <>
                      <span className="grid">
                        <span>{ar ? l.titleAr : l.titleEn}</span>
                        <span className="text-label text-ink-muted">{(l.instructor ?? course.instructor).name}</span>
                      </span>
                      <span className={`text-label ${rented ? "text-up" : "text-ink-muted"}`}>
                        {rented && until ? t("rented", { date: date.format(until) }) : t(`kind.${l.kind}`)}
                      </span>
                    </>
                  );
                  return (
                    <li key={l.id} className="border-t border-hairline first:border-t-0">
                      {open ? (
                        <Link
                          href={lessonHref(l.id)}
                          className="flex items-center justify-between gap-3 rounded-sm px-2 py-3 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
                        >
                          {label}
                        </Link>
                      ) : (
                        <div className="flex items-center justify-between gap-3 px-2 py-3 text-ink-muted">
                          <span className="flex items-center gap-2">
                            <LockIcon />
                            <span className="grid">
                              <span>{ar ? l.titleAr : l.titleEn}</span>
                              <span className="text-label">{(l.instructor ?? course.instructor).name}</span>
                            </span>
                          </span>
                          {rent ? (
                            <Link
                              href={{ pathname: "/checkout", query: { sku: rent.id } }}
                              className="btn btn-outline shrink-0 px-3 py-1.5 text-small"
                            >
                              {t("rent")} · <span className="num">{formatMoney(effectivePrice(rent, now), rent.currency, locale)}</span> · {t("rentFor", { days: rent.accessDays ?? 0 })}
                            </Link>
                          ) : (
                            <span className="text-label">{t(`kind.${l.kind}`)}</span>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      {live.length > 0 && (
        <section id="live" className="grid scroll-mt-6 gap-4">
          <h2 className="font-display text-h2 font-semibold">{t("live")}</h2>
          <ul className="grid gap-3">
            {live.map((l) => {
              const seat = l.sku?.active && (!l.sku.saleTo || l.sku.saleTo > now) ? l.sku : null;
              return (
                <li key={l.id}>
                  <Link
                    href={`/live/${l.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-hairline bg-surface p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
                  >
                    <span className="grid gap-1">
                      <span className="font-display font-semibold">{ar ? l.titleAr : l.titleEn}</span>
                      <span className="text-small text-ink-muted">{formatWhen(l.startsAt, courseZone(course), locale)}</span>
                    </span>
                    <span className="text-small font-semibold">
                      {grants.some((g) => opensLive(g, l.id, now)) ? (
                        <span className="text-up">{t("liveIncluded")}</span>
                      ) : seat ? (
                        <>
                          {t("liveSeat")} · <span className="num">{formatMoney(effectivePrice(seat, now), seat.currency, locale)}</span>
                        </>
                      ) : (
                        <span className="text-ink-muted">{t("liveSubscribers")}</span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!owned && (single || months.length > 0 || terms.length > 0) && (
        <section id="packages" className="grid scroll-mt-6 gap-4">
          <h2 className="font-display text-h2 font-semibold">{tp("title")}</h2>
          {/* Side by side from tablet width; on phones the semester comes first. */}
          <ul className="grid gap-4 sm:grid-cols-3">
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
                  { on: true, text: tp("semesterIncl", { count: lecturesIn(course.units, terms[0]) }) },
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

      {!owned && !single && months.length === 0 && terms.length === 0 && (
        <section className="grid gap-2">
          <h2 className="font-display text-h2 font-semibold">{tp("title")}</h2>
          <p className="text-ink-muted">{t("noPackages")}</p>
        </section>
      )}

      {!owned && others.length > 0 && (
        <section className="grid gap-4">
          <h2 className="font-display text-h2 font-semibold">{tp("other")}</h2>
          <ul className="grid gap-3">
            {others.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-hairline bg-surface p-4">
                <div className="grid gap-1">
                  <span className="font-display font-semibold">{t(`access.${s.accessType}`, { days: s.accessDays ?? 0 })}</span>
                  {s.accessEndsAt && (
                    <span className="text-small text-ink-muted">{t("until", { date: date.format(s.accessEndsAt) })}</span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex items-baseline gap-2">
                    {discountPercent(s, now) !== null && <s className="num text-small text-ink-muted">{formatMoney(s.price, s.currency, locale)}</s>}
                    <span className="num text-h3 font-semibold">{formatMoney(effectivePrice(s, now), s.currency, locale)}</span>
                  </span>
                  <Link
                    href={{ pathname: "/checkout", query: { sku: s.id } }}
                    className="rounded-sm border border-ink-muted px-4 py-2 font-display font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
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
