import Image from "next/image";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Notice } from "@/components/OneDevice";
import { VdoFrame, type LiveMode } from "@/components/learning/VdoFrame";
import { LiveBadge } from "@/components/learning/LiveBadge";
import { StatusChip } from "@/components/ui/StatusChip";
import { Link } from "@/i18n/navigation";
import { logEventLater } from "@/lib/analytics";
import { isCourseStaff } from "@/lib/catalog";
import { clientIp } from "@/lib/client-ip";
import { pick } from "@/lib/content";
import { db } from "@/lib/db";
import { courseZone, formatWhen } from "@/lib/format";
import { logError } from "@/lib/log-error";
import { appUrl } from "@/lib/mail";
import { PROOF_MIN, WATCHING_MIN, inLiveWindow, liveOffsetSec, premiereStage, shownCount } from "@/lib/premiere";
import { pastJoined } from "@/lib/premiere-stats";
import { alternates } from "@/lib/seo";
import { getPlayback, playerUrl } from "@/lib/vdocipher";
import { Countdown } from "../../live/[id]/Countdown";
import { remindMe } from "./actions";
import { ShareRow } from "./ShareRow";
import { WatchingNow } from "./WatchingNow";

// Never cached: the playback token is created here, and only when the stage says so.
export const dynamic = "force-dynamic";

const load = (slug: string) =>
  db.premiere.findUnique({
    where: { slug },
    include: {
      video: { select: { provider: true, externalId: true, durationSec: true } },
      course: {
        include: {
          grade: { include: { country: true } },
          instructor: { select: { id: true, name: true, photoUrl: true } },
          units: { select: { _count: { select: { lessons: true } } } },
        },
      },
    },
  });

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await load(slug);
  if (!p || !p.course.published || p.cancelledAt) return { robots: { index: false, follow: false } };
  const ar = locale === "ar";
  return {
    title: pick(ar, p.titleAr, p.titleEn),
    description: pick(ar, p.blurbAr, p.blurbEn) || pick(ar, p.course.headlineAr, p.course.headlineEn) || undefined,
    alternates: alternates(locale, `/premiere/${slug}`),
  };
}

/** The protected player. Only reached when `premiereStage` said "watch"; the token is created here and nowhere else. */
async function Player({ videoId, title, path, userId, startAt, live }: { videoId: string; title: string; path: string; userId: string; startAt: number; live?: LiveMode }) {
  const t = await getTranslations("premiere");
  const ip = clientIp(await headers());
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, phone: true } });
  try {
    const src = playerUrl(await getPlayback(videoId, [user.name, user.phone, ip].filter(Boolean).join(" · ")));
    return <VdoFrame key={path} src={src} title={title} next={null} startAt={startAt || undefined} live={live} />;
  } catch (e) {
    console.error(e);
    await logError("video.playback", e, { message: "premiere playback token failed", path, userId });
    return <Notice>{t("unavailable")}</Notice>;
  }
}

export default async function PremierePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ src?: string; live?: string }>;
}) {
  const { locale, slug } = await params;
  const { src, live: previewLive } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("premiere");
  const ar = locale === "ar";
  const now = new Date();

  const p = await load(slug);
  if (!p) notFound();
  const session = await auth();
  const staff = isCourseStaff(session?.user, p.course);
  if (!p.course.published && !staff) notFound();

  const { course } = p;
  const path = `/${locale}/premiere/${p.slug}`;
  const endsAt = p.video.durationSec ? new Date(p.startsAt.getTime() + p.video.durationSec * 1000) : null;
  const stage = premiereStage({ now, startsAt: p.startsAt, endsAt, replay: p.replay, cancelled: !!p.cancelledAt, signedIn: !!session?.user, staff });
  const started = now >= p.startsAt;
  const liveWindow = inLiveWindow(now, p.startsAt, p.video.durationSec);
  const userId = session?.user?.id;
  // In its live window the recording is locked like a stream (no timeline, no pause). Staff see the normal player, or the locked one with ?live=1 to check it.
  const lock = !!p.video.durationSec && (staff ? previewLive === "1" : liveWindow);
  const live: LiveMode | undefined = lock
    ? { startsAtMs: p.startsAt.getTime(), nowMs: now.getTime(), durationSec: p.video.durationSec!, labels: { mute: t("mute"), unmute: t("unmute"), fullscreen: t("fullscreen") } }
    : undefined;
  const title = pick(ar, p.titleAr, p.titleEn);
  const blurb = pick(ar, p.blurbAr, p.blurbEn) || pick(ar, course.headlineAr, course.headlineEn);
  const when = formatWhen(p.startsAt, courseZone(course), locale);
  const lessons = course.units.reduce((n, u) => n + u._count.lessons, 0);
  // Before the start: how many joined the course's earlier streams. After the live window: the course's next stream, if set.
  const [joinedBefore, next] = await Promise.all([
    started ? 0 : pastJoined(course.id, p.startsAt).then((n) => shownCount(n, PROOF_MIN)),
    started && !liveWindow
      ? db.premiere.findFirst({ where: { courseId: course.id, cancelledAt: null, startsAt: { gt: now } }, orderBy: { startsAt: "asc" }, select: { slug: true, titleAr: true, titleEn: true, startsAt: true } })
      : null,
  ]);
  const reminded = userId && stage === "countdown" ? !!(await db.premiereRsvp.findUnique({ where: { userId_premiereId: { userId, premiereId: p.id } } })) : false;

  // One event per viewer per day; `src` says which ad or message sent them (ig-story, wa, ...).
  void logEventLater({ name: "premiere_viewed", userId, courseId: course.id, props: { slug: p.slug, stage, src: (src ?? "").slice(0, 40) }, dedupeScope: p.id });
  if (stage === "watch" && !staff) void logEventLater({ name: "premiere_joined", userId, courseId: course.id, props: { slug: p.slug, src: (src ?? "").slice(0, 40) }, dedupeScope: p.id });

  return (
    <main className="mx-auto grid max-w-4xl gap-8 px-4 py-10 md:py-16">
      <header className="grid gap-6">
        {course.coverKey && (
          <span className="relative block aspect-[16/9] w-full overflow-hidden rounded-lg">
            <Image src={`/api/covers/${course.id}?v=${course.coverKey.split("/").pop()}`} alt="" fill priority sizes="(min-width: 896px) 896px, 100vw" className="object-cover" />
          </span>
        )}
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {stage !== "cancelled" && (liveWindow ? <LiveBadge>{t("badge")}</LiveBadge> : started ? <StatusChip tone="neutral">{t("replay")}</StatusChip> : <LiveBadge soon>{t("soon")}</LiveBadge>)}
            <StatusChip tone="neutral">{t("free")}</StatusChip>
            {stage === "watch" && liveWindow && userId && <WatchingNow premiereId={p.id} min={WATCHING_MIN} label={t("watching", { count: "__N__" })} />}
          </div>
          <h1 className="font-display text-display leading-[1.15] font-bold">{title}</h1>
          {blurb && <p className="max-w-[65ch] text-lede font-medium">{blurb}</p>}
          <div className="flex flex-wrap items-center gap-3 text-small text-ink-muted">
            {course.instructor.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/avatars/${course.instructor.id}`} alt="" className="size-10 shrink-0 rounded-full object-cover" />
            ) : null}
            <span>{t("with", { name: course.instructor.name })}</span>
            <span aria-hidden="true">·</span>
            <span className="num">{when}</span>
          </div>
          {joinedBefore && <p className="num text-small font-semibold">{t("joinedBefore", { count: joinedBefore })}</p>}
        </div>
      </header>

      {stage === "cancelled" && (
        <section className="card p-6">
          <Notice>{t("cancelled")}</Notice>
        </section>
      )}

      {stage === "signin" && (
        <section className="grid justify-items-center gap-4 card p-6 text-center">
          {!started && (
            <>
              <p className="text-small text-ink-muted">{t("startsIn")}</p>
              <Countdown at={p.startsAt.toISOString()} locale={locale} />
            </>
          )}
          <p className="max-w-[45ch] text-ink-muted">{t("joinHint")}</p>
          <Link href={{ pathname: "/signup", query: { next: path } }} className="btn btn-primary">
            {t("joinFree")}
          </Link>
          <p className="text-small text-ink-muted">
            {t("haveAccount")}{" "}
            <Link href={{ pathname: "/signin", query: { next: path } }} className="text-pen underline underline-offset-4">
              {t("signIn")}
            </Link>
          </p>
        </section>
      )}

      {stage === "countdown" && (
        <section className="grid justify-items-center gap-4 card p-6 text-center">
          <p className="text-small text-ink-muted">{t("startsIn")}</p>
          <Countdown at={p.startsAt.toISOString()} locale={locale} />
          {reminded ? (
            <p className="text-small font-medium text-pen" role="status">
              {t("reminded")}
            </p>
          ) : (
            <form action={remindMe}>
              <input type="hidden" name="slug" value={p.slug} />
              <button className="btn btn-outline">{t("remindMe")}</button>
            </form>
          )}
        </section>
      )}

      {stage === "watch" && userId && (
        <section className="grid gap-3">
          <div className={`relative aspect-video overflow-hidden card ${liveWindow ? "border-down" : ""}`}>
            {liveWindow && <LiveBadge className="pointer-events-none absolute start-3 top-3 z-10">{t("badge")}</LiveBadge>}
            {p.video.provider === "VDOCIPHER" ? (
              <Player videoId={p.video.externalId} title={title} path={path} userId={userId} startAt={liveOffsetSec(now, p.startsAt, p.video.durationSec)} live={live} />
            ) : (
              <Notice>{t("unavailable")}</Notice>
            )}
          </div>
        </section>
      )}

      {stage === "ended" && (
        <section className="card p-6">
          <Notice>{t("over")}</Notice>
        </section>
      )}

      {next && (
        <section className="grid gap-3 card border-down p-6">
          <LiveBadge soon className="justify-self-start">{t("nextTitle")}</LiveBadge>
          <h2 className="font-display text-h2 font-bold">{pick(ar, next.titleAr, next.titleEn)}</h2>
          <p className="num text-small text-ink-muted">{formatWhen(next.startsAt, courseZone(course), locale)}</p>
          <div>
            <Link href={`/premiere/${next.slug}`} className="btn btn-primary">
              {t("nextCta")}
            </Link>
          </div>
        </section>
      )}

      {stage !== "cancelled" && (
        <ShareRow
          url={`${appUrl()}${path}`}
          text={`${title} · ${t("shareText", { when })}`}
          labels={{ title: t("shareTitle"), whatsapp: t("shareWhatsapp"), more: t("shareMore") }}
        />
      )}

      <section className="grid gap-3 card p-6">
        <p className="text-label font-medium text-ink-muted">{t("fromCourse")}</p>
        <h2 className="font-display text-h2 font-bold">{pick(ar, course.titleAr, course.titleEn)}</h2>
        <p className="num text-small text-ink-muted">{t("inside", { units: course.units.length, lessons })}</p>
        {stage === "watch" || stage === "ended" ? <p className="font-medium">{t("afterTitle")}</p> : null}
        <div>
          <Link href={`/courses/${course.slug}`} className={stage === "watch" || stage === "ended" ? "btn btn-primary" : "btn btn-outline"}>
            {t("seeCourse")}
          </Link>
        </div>
      </section>
    </main>
  );
}
