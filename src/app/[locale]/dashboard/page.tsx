import { pageMetadata } from "@/lib/seo";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { EmptyState } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { courseZone, formatWhen } from "@/lib/format";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/dashboard", "dashboard", { key: "title", noindex: true });
}

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/dashboard`)}`);
  if (session.user.role === "INSTRUCTOR") redirect(`/${locale}/teacher`);
  if (session.user.role === "PARENT") redirect(`/${locale}/parent`);
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
  // Live lectures the student can join: every session of a course subscribed for a term or longer, plus bought seats.
  const subscribed = entitlements.filter((e) => !e.lessonId && !e.liveSessionId && e.accessType !== "MONTHLY" && isActive(e, now)).map((e) => e.courseId);
  // Answers from the last two weeks go to the top of the page.
  const answers = await db.question.findMany({
    where: { userId: session.user.id, answeredAt: { gt: new Date(now.getTime() - 14 * 86_400_000) } },
    orderBy: { answeredAt: "desc" },
    take: 5,
    include: { answeredBy: { select: { name: true } }, lesson: { include: { unit: { include: { course: { select: { slug: true } } } } } } },
  });
  const tq = await getTranslations("questions");
  const lastView = await db.lessonView.findFirst({
    where: { userId: session.user.id, completedAt: null },
    orderBy: { lastSeenAt: "desc" },
    include: { lesson: { include: { unit: { include: { course: { select: { slug: true, titleAr: true, titleEn: true } } } } } } },
  });
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
      {lastView && (
        <section className="grid gap-3">
          <h2 className="font-display text-h2 font-semibold">{t("continue")}</h2>
          <Link
            href={`/courses/${lastView.lesson.unit.course.slug}/lessons/${lastView.lesson.id}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-pen bg-surface p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
          >
            <span className="grid gap-1">
              <span className="font-display font-semibold">{ar ? lastView.lesson.titleAr : lastView.lesson.titleEn}</span>
              <span className="text-small text-ink-muted">{ar ? lastView.lesson.unit.course.titleAr : lastView.lesson.unit.course.titleEn}</span>
            </span>
            <span className="text-small text-pen">{t("resume")}</span>
          </Link>
        </section>
      )}
      {answers.length > 0 && (
        <section className="grid gap-3">
          <h2 className="font-display text-h2 font-semibold">{tq("newAnswers")}</h2>
          <ul className="grid gap-2">
            {answers.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/courses/${q.lesson.unit.course.slug}/lessons/${q.lessonId}`}
                  className="grid gap-1 rounded-md border border-hairline bg-surface p-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised"
                >
                  <span className="text-small text-ink-muted">{ar ? q.lesson.titleAr : q.lesson.titleEn}</span>
                  <span dir="auto" className="line-clamp-2">{q.answer}</span>
                  <span className="text-label font-semibold text-pen">{tq("answeredBy", { name: q.answeredBy?.name ?? "" })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="grid gap-4">
        <h2 className="font-display text-h2 font-semibold">{t("myCourses")}</h2>
        {rows.length === 0 ? (
          <EmptyState>
            <p className="text-ink-muted">{t("empty")}</p>
            <Link
              href="/courses"
              className="btn btn-primary w-fit"
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
