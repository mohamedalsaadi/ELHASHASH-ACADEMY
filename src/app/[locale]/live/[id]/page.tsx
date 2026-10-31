import { pageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Notice, oneDevice, secondaryButton } from "@/components/OneDevice";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import { logEventLater } from "@/lib/analytics";
import { liveRole } from "@/lib/catalog";
import { createRoom, meetingToken } from "@/lib/daily";
import { db } from "@/lib/db";
import { courseZone, formatMoney, formatWhen } from "@/lib/format";
import { LIVE_LEAD_MIN, livePhase, roomOpensAt } from "@/lib/learning";
import { effectivePrice } from "@/lib/pricing-engine";
import { Countdown } from "./Countdown";

export const dynamic = "force-dynamic";

const primaryButton = "btn btn-primary";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/live", "live", { key: "title", noindex: true });
}

export default async function LivePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("live");
  const tp = await getTranslations("player");
  const ar = locale === "ar";
  const now = new Date();

  const s = await db.liveSession.findUnique({
    where: { id },
    include: { course: { include: { grade: { include: { country: true } } } }, sku: true },
  });
  if (!s) notFound();
  const session = await auth();
  const role = await liveRole(session?.user, s, now);
  if (!s.course.published && role !== "host") notFound();

  const endsAt = new Date(s.startsAt.getTime() + s.durationMin * 60_000);
  const path = `/${locale}/live/${s.id}`;
  const title = ar ? s.titleAr : s.titleEn;

  async function stage(): Promise<React.ReactNode> {
    const exits = (
      <div className="flex flex-wrap justify-center gap-3">
        <Link href={`/courses/${s!.course.slug}#units`} className={secondaryButton}>
          {t("backToCourse")}
        </Link>
        <Link href="/dashboard" className={secondaryButton}>
          {t("backToDashboard")}
        </Link>
      </div>
    );
    if (s!.cancelledAt)
      return (
        <Notice>
          <p>{t("isCancelled")}</p>
          {exits}
        </Notice>
      );
    if (now >= endsAt)
      return (
        <Notice>
          <p>{t("ended")}</p>
          {exits}
        </Notice>
      );
    if (!session?.user) {
      return (
        <Notice>
          <p>{t("signIn")}</p>
          <Link href={{ pathname: "/signin", query: { next: path } }} className={secondaryButton}>
            {tp("signInCta")}
          </Link>
        </Notice>
      );
    }
    if (!role) {
      const sku = s!.sku;
      const seat = sku?.active && (!sku.saleTo || sku.saleTo > now) ? sku : null;
      return (
        <Notice>
          <p className="max-w-[45ch]">{t("noSeat")}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {seat && (
              <Link href={{ pathname: "/checkout", query: { sku: seat.id } }} className={primaryButton}>
                {t("buySeat", { price: formatMoney(effectivePrice(seat, now), seat.currency, locale) })}
              </Link>
            )}
            <Link href={`/courses/${s!.course.slug}#packages`} className={secondaryButton}>
              {t("subscribe")}
            </Link>
          </div>
        </Notice>
      );
    }

    const opensAt = roomOpensAt(s!.startsAt, LIVE_LEAD_MIN[role]);
    if (now < opensAt) {
      return (
        <Notice>
          <p>{t("opensIn")}</p>
          <Countdown at={opensAt.toISOString()} locale={locale} />
          <p className="text-small">{t("opensHint", { minutes: LIVE_LEAD_MIN[role] })}</p>
        </Notice>
      );
    }

    // One device per account, as for recorded lectures; the teacher may host from anywhere.
    const [device, user] = await Promise.all([
      role === "student" ? oneDevice(session.user.id, path) : Promise.resolve(null),
      db.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { name: true } }),
    ]);
    if (device && "block" in device) return device.block;
    if (role === "student") {
      await db.liveAttendance.upsert({
        where: { userId_liveSessionId: { userId: session.user.id, liveSessionId: s!.id } },
        create: { userId: session.user.id, liveSessionId: s!.id },
        update: {},
      });
    }
    void logEventLater({ name: "live_joined", userId: session.user.id, courseId: s!.courseId, props: { role } });
    try {
      let roomUrl = s!.roomUrl;
      if (!roomUrl) {
        roomUrl = await createRoom(s!.id, endsAt);
        await db.liveSession.update({ where: { id: s!.id }, data: { roomUrl } });
      }
      const token = await meetingToken({
        sessionId: s!.id,
        userId: session.user.id,
        // The phone never enters the room: every participant would see it in the tile and chat.
        userName: user.name,
        startsAt: s!.startsAt,
        endsAt,
        owner: role === "host",
      });
      return (
        <iframe
          src={`${roomUrl}?t=${encodeURIComponent(token)}`}
          title={title}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          allowFullScreen
          className="size-full"
        />
      );
    } catch (e) {
      console.error(e);
      return <Notice>{tp("unavailable")}</Notice>;
    }
  }

  const phase = livePhase(s.startsAt, s.durationMin, now);
  const liveNow = phase === "now" && !!role;
  const minutesToStart = Math.max(1, Math.round((s.startsAt.getTime() - now.getTime()) / 60_000));

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-12">
      <PageHeader
        back={{ href: `/courses/${s.course.slug}`, label: ar ? s.course.titleAr : s.course.titleEn }}
        title={title}
        meta={`${formatWhen(s.startsAt, courseZone(s.course), locale)} · ${t("minutes", { count: s.durationMin })}`}
        actions={
          role ? (
            liveNow ? (
              <StatusChip tone="live">{t("liveNow")}</StatusChip>
            ) : phase === "soon" ? (
              <StatusChip tone="expiring">{t("startsSoon", { minutes: minutesToStart })}</StatusChip>
            ) : null
          ) : null
        }
      />
      <p className="rounded-sm border border-hairline bg-raised px-3 py-2 text-small text-ink-muted">{t("contactRule")}</p>
      <div
        className={`aspect-[3/4] overflow-hidden rounded-md border bg-surface sm:aspect-video ${liveNow ? "border-pen" : "border-hairline"}`}
      >
        {await stage()}
      </div>
    </main>
  );
}
