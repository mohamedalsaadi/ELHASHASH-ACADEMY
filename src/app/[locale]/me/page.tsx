import { pick as pickText } from "@/lib/content";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { CourseCard } from "@/components/CourseCard";
import { GradePicker } from "@/components/GradePicker";
import { Ride, type RideSubject } from "@/components/three/Ride";
import { Link } from "@/i18n/navigation";
import { gradeGroups } from "@/lib/catalog";
import { db } from "@/lib/db";
import { formatMoney, formatWhen } from "@/lib/format";
import { getStudentHome } from "@/lib/student-home-server";
import { resolveCountry, RIDE_COUNTRY } from "@/lib/student-home";
import PublicHome from "../page";
import { clearCountry, setCountry } from "./actions";

// Reached by a rewrite of "/" when a session cookie is present (src/middleware.ts); the address stays "/".
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  // Private, and reachable at "/" through a rewrite: never index it, never give it the home canonical.
  return { robots: { index: false, follow: false } };
}

export default async function StudentHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  // Parents, teachers, admins and a stale cookie all get the public home.
  if (session?.user?.role !== "STUDENT") return <PublicHome params={params} />;

  const now = new Date();
  const t = await getTranslations("me");
  const ar = locale === "ar";
  const Arrow = ar ? ArrowLeft : ArrowRight;

  // The country comes first: ask once, remember it, and only then show that country's subjects.
  const countries = await db.country.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
    include: { _count: { select: { grades: { where: { active: true } } } } },
  });
  const chosen = (await cookies()).get(RIDE_COUNTRY)?.value;
  const pick = resolveCountry(chosen, countries.map((c) => c.id));

  if (pick.mode === "ask") {
    return (
      <main className="mx-auto grid max-w-3xl gap-6 px-4 py-16">
        <h1 className="font-display text-h1 font-bold">{t("pickCountryTitle")}</h1>
        <p className="text-ink-muted">{t("pickCountryHint")}</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {countries.map((c) => (
            <li key={c.id}>
              <form action={setCountry}>
                <input type="hidden" name="id" value={c.id} />
                <button className="card hover-lift flex min-h-11 w-full items-center gap-4 p-5 text-start">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/flags/${c.code.toLowerCase()}.svg`} alt="" width={28} height={20} loading="lazy" decoding="async" className="h-7 w-auto rounded-sm" />
                  <span className="grid gap-0.5">
                    <span className="font-display text-h3 font-bold">{pickText(ar, c.nameAr, c.nameEn)}</span>
                    <span className="text-small text-ink-muted">{t("gradeCount", { count: c._count.grades })}</span>
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  const country = countries.find((c) => c.id === pick.countryId)!;
  const me = await db.user.findUnique({ where: { id: session.user.id }, select: { gradeId: true, grade: { select: { countryId: true } } } });
  const gradeId = me?.grade?.countryId === country.id ? (me.gradeId ?? undefined) : undefined;
  const home = gradeId ? await getStudentHome(session.user.id, now, gradeId) : null;

  if (!home) {
    const groups = (await gradeGroups(locale)).filter((g) => g.countryId === country.id);
    return (
      <main className="mx-auto grid max-w-xl gap-5 px-4 py-20">
        <h1 className="font-display text-h1 font-bold">{t("pickGradeIn", { country: pickText(ar, country.nameAr, country.nameEn) })}</h1>
        <p className="text-ink-muted">{t("pickHint")}</p>
        <GradePicker groups={groups} current={null} label={t("grade")} save={t("pickSave")} />
        <form action={clearCountry}>
          <button className="text-small text-ink-muted underline underline-offset-4">{t("changeCountry")}</button>
        </form>
      </main>
    );
  }

  const { grade, subjects, owned, bundle, live } = home;
  const gradeName = pickText(ar, grade.nameAr, grade.nameEn);
  const countryName = pickText(ar, grade.country.nameAr, grade.country.nameEn);
  const code = grade.country.code.toLowerCase();
  const line = `var(--color-line-${code}, var(--color-primary))`;
  const ownedIds = new Set(owned.map((c) => c.id));
  const name = (s: { nameAr: string; nameEn: string }) => (pickText(ar, s.nameAr, s.nameEn));

  // What can be bought comes first, then what the student already has; empty subjects only get a "coming soon" line.
  const ready = [...subjects.filter((s) => s.courses.length && !s.owned), ...subjects.filter((s) => s.courses.length && s.owned)];
  const empty = subjects.filter((s) => s.courses.length === 0);
  const ride: RideSubject[] = ready.slice(0, 8).map((s) => ({
    id: s.id,
    anchor: `subject-${s.slug}`,
    name: name(s),
    icon: s.icon,
    meta: s.owned ? t("yours") : t("courses", { count: s.courses.length }),
    price: s.from && !s.owned ? t("from", { price: formatMoney(s.from.amount, s.from.currency, locale) }) : "",
    cta: t("see", { subject: name(s) }),
  }));
  const bundleNames = bundle ? subjects.filter((s) => bundle.subjectIds.includes(s.id)).map(name) : [];
  const zone = grade.country.timeZone;

  return (
    <main>
      <section className="stage">
        <div className="relative mx-auto grid max-w-(--container-page) gap-8 px-4 pt-14 pb-12 md:pt-20">
          <div className="grid max-w-[40rem] gap-4">
            <span className="text-label font-medium text-night-muted">{t("hello", { name: home.name.split(" ")[0] })}</span>
            <h1 className="flex flex-wrap items-center gap-3 font-display text-display leading-tight font-bold">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/flags/${code}.svg`} alt="" width={28} height={20} loading="lazy" decoding="async" className="h-7 w-auto rounded-sm" />
              {t("title", { grade: gradeName, country: countryName })}
            </h1>
            <p className="text-night-muted">{t("lede", { count: ready.length })}</p>
            <form action={clearCountry}>
              <button className="min-h-11 text-small text-night-muted underline underline-offset-4">{t("changeCountry")}</button>
            </form>
          </div>
          <Ride subjects={ride} rtl={ar} countryCode={grade.country.code} label={t("subjects")} />
          {ride.length > 0 ? (
            <p className="text-center text-small text-night-muted">{t("hint")}</p>
          ) : (
            <p className="text-night-muted">{t("noneYet")}</p>
          )}
        </div>
      </section>

      <div className="mx-auto grid max-w-(--container-page) gap-16 px-4 py-16 md:gap-20">
        {owned.length > 0 && (
          <section className="grid gap-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-h1 font-bold">{t("continue")}</h2>
              <Link href="/dashboard" className="btn btn-outline">
                {t("dashboard")}
                <Arrow aria-hidden="true" className="size-4" strokeWidth={2.5} />
              </Link>
            </div>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {owned.map((c) => (
                <li key={c.id}>
                  <CourseCard course={c} locale={locale} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {bundle && (
          <section className="card grid gap-4 border-t-(length:--line) p-7 md:grid-cols-[1fr_auto] md:items-center md:p-10" style={{ borderTopColor: line }}>
            <div className="grid gap-2">
              <span className="text-label font-medium text-ink-muted">{t("bundle.k")}</span>
              <h2 className="font-display text-h1 font-bold">{t("bundle.title", { subjects: bundleNames.join(ar ? "، " : ", ") })}</h2>
              <p className="text-ink-muted">
                <s className="num">{formatMoney(bundle.subtotal, bundle.currency, locale)}</s>{" "}
                <span className="num font-display text-h2 font-bold text-ink">{formatMoney(bundle.total, bundle.currency, locale)}</span>{" "}
                {t("bundle.save", { amount: formatMoney(bundle.subtotal - bundle.total, bundle.currency, locale) })}
              </p>
            </div>
            <Link href={`/checkout?${bundle.skuIds.map((id) => `sku=${encodeURIComponent(id)}`).join("&")}`} className="btn btn-primary">
              {t("bundle.cta")}
              <Arrow aria-hidden="true" className="size-4" strokeWidth={2.5} />
            </Link>
          </section>
        )}

        <div className="grid gap-14">
          {ready.map((s) => (
            <section key={s.id} id={`subject-${s.slug}`} className="grid scroll-mt-24 gap-5">
              <div className="flex items-center gap-3">
                {/* The country's trail colour marks each waypoint section. */}
                <i aria-hidden="true" className="h-6 w-1 rounded-full" style={{ background: line }} />
                <h2 className="font-display text-h2 font-bold">{name(s)}</h2>
                <span className="text-small text-ink-muted">{t("courses", { count: s.courses.length })}</span>
              </div>
              <ul className="-mx-4 flex snap-x gap-5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
                {s.courses.map((c) => (
                  <li key={c.id} className="relative w-[82%] shrink-0 snap-start sm:w-auto">
                    <CourseCard course={c} locale={locale} />
                    {ownedIds.has(c.id) && (
                      <span className="absolute start-3 top-3 rounded-full bg-up px-2.5 py-0.5 text-label font-semibold text-surface">{t("yours")}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {empty.length > 0 && (
            <p className="text-ink-muted">
              <span className="font-semibold text-ink">{t("soon")}:</span> {empty.map(name).join(ar ? "، " : ", ")}
            </p>
          )}
        </div>

        {live.length > 0 && (
          <section className="grid gap-5">
            <h2 className="font-display text-h1 font-bold">{t("live")}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {live.map((l) => (
                <li key={l.id} className="card flex flex-wrap items-center justify-between gap-3 p-5">
                  <span className="grid gap-0.5">
                    <span className="font-display font-semibold">{pickText(ar, l.titleAr, l.titleEn)}</span>
                    <span className="text-small text-ink-muted">
                      {pickText(ar, l.course.titleAr, l.course.titleEn)} · <span className="num">{formatWhen(l.startsAt, zone, locale)}</span>
                    </span>
                  </span>
                  <Link href={`/live/${l.id}`} className="btn btn-outline px-3 py-1.5 text-small">
                    {t("liveOpen")}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-small text-ink-muted">
          {t("notYours")}{" "}
          <Link href="/account" className="text-pen underline underline-offset-4">
            {t("change")}
          </Link>
        </p>
      </div>
    </main>
  );
}
