import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { EmptyState } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { courseZone, formatWhen } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/dashboard`)}`);
  if (session.user.role === "INSTRUCTOR") redirect(`/${locale}/teacher`);
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("catalog");
  const ar = locale === "ar";
  const now = new Date();

  const entitlements = await db.entitlement.findMany({
    where: { userId: session.user.id, startsAt: { lte: now } },
    include: { course: { include: { grade: true } }, lesson: true },
  });
  // One row per course, keeping the access that lasts longest (null = no end).
  const byCourse = new Map<string, (typeof entitlements)[number]>();
  for (const e of entitlements) {
    if (e.lessonId || e.liveSessionId) continue;
    const best = byCourse.get(e.courseId);
    if (!best || (best.endsAt && (!e.endsAt || e.endsAt > best.endsAt))) byCourse.set(e.courseId, e);
  }
  const rows = [...byCourse.values()].sort((a, b) => Number(isActive(b, now)) - Number(isActive(a, now)));
  const rentals = entitlements
    .filter((e) => e.lesson && isActive(e, now))
    .sort((a, b) => (a.endsAt?.getTime() ?? Infinity) - (b.endsAt?.getTime() ?? Infinity));
  const date = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "long", timeZone: "Africa/Cairo" });
  // Live lectures the student can join: every session of a subscribed course, plus sessions with a bought seat.
  const subscribed = rows.filter((e) => isActive(e, now)).map((e) => e.courseId);
  const seats = entitlements.filter((e) => e.liveSessionId && isActive(e, now)).map((e) => e.liveSessionId!);
  const live = (
    await db.liveSession.findMany({
      where: { cancelledAt: null, startsAt: { gt: new Date(now.getTime() - 5 * 3_600_000) }, OR: [{ courseId: { in: subscribed } }, { id: { in: seats } }] },
      orderBy: { startsAt: "asc" },
      include: { course: { include: { grade: { include: { country: true } } } } },
    })
  ).filter((l) => l.startsAt.getTime() + l.durationMin * 60_000 > now.getTime());

  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-4 py-12">
      <h1 className="font-display text-h1 font-semibold">{t("hello", { name: session.user.name ?? "" })}</h1>
      <section className="grid gap-4">
        <h2 className="font-display text-h2 font-semibold">{t("myCourses")}</h2>
        {rows.length === 0 ? (
          <EmptyState>
            <p className="text-ink-muted">{t("empty")}</p>
            <Link
              href="/courses"
              className="w-fit rounded-sm bg-primary px-[18px] py-3 font-display font-semibold text-on-primary transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-[color-mix(in_oklab,var(--color-primary)_86%,#fff)]"
            >
              {t("browse")}
            </Link>
          </EmptyState>
        ) : (
          <ul className="grid gap-3">
            {rows.map((e) => {
              const active = isActive(e, now);
              return (
                <li key={e.courseId}>
                  <Link
                    href={active ? `/courses/${e.course.slug}` : `/courses/${e.course.slug}#packages`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-hairline bg-surface p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
                  >
                    <span className="grid gap-1">
                      <span className="font-display font-semibold">{ar ? e.course.titleAr : e.course.titleEn}</span>
                      <span className="text-small text-ink-muted">{e.course.grade ? (ar ? e.course.grade.nameAr : e.course.grade.nameEn) : tc("skill")}</span>
                    </span>
                    <span className={`text-small ${active ? "text-up" : "text-down"}`}>
                      {!active ? t("expired") : e.endsAt ? t("until", { date: date.format(e.endsAt) }) : t("forever")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {live.length > 0 && (
        <section className="grid gap-4">
          <h2 className="font-display text-h2 font-semibold">{t("myLive")}</h2>
          <ul className="grid gap-3">
            {live.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/live/${l.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-hairline bg-surface p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
                >
                  <span className="grid gap-1">
                    <span className="font-display font-semibold">{ar ? l.titleAr : l.titleEn}</span>
                    <span className="text-small text-ink-muted">{ar ? l.course.titleAr : l.course.titleEn}</span>
                  </span>
                  <span className="text-small text-pen">{formatWhen(l.startsAt, courseZone(l.course), locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {rentals.length > 0 && (
        <section className="grid gap-4">
          <h2 className="font-display text-h2 font-semibold">{t("myRentals")}</h2>
          <ul className="grid gap-3">
            {rentals.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/courses/${e.course.slug}/lessons/${e.lesson!.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-hairline bg-surface p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
                >
                  <span className="grid gap-1">
                    <span className="font-display font-semibold">{ar ? e.lesson!.titleAr : e.lesson!.titleEn}</span>
                    <span className="text-small text-ink-muted">{ar ? e.course.titleAr : e.course.titleEn}</span>
                  </span>
                  <span className="text-small text-up">{e.endsAt ? t("until", { date: date.format(e.endsAt) }) : t("forever")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function isActive(e: { endsAt: Date | null }, now: Date) {
  return !e.endsAt || e.endsAt > now;
}
