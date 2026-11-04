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
import { db } from "@/lib/db";
import { courseZone, formatMoney, formatWhen } from "@/lib/format";
import { LIVE_LEAD_MIN, livePhase, roomOpensAt } from "@/lib/learning";
import { hasGuardianConsent, liveApprovedOn } from "@/lib/live";
import { meetingProvider } from "@/lib/live-rules";
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
    include: {
      course: { include: { grade: { include: { country: true } }, instructor: { select: { liveApproved: true } } } },
      sku: true,
    },
  });
  if (!s) notFound();
  const session = await auth();
  // Live is hidden for any teacher an admin has not approved, including their own session page.
  if (!liveApprovedOn(s.course) && session?.user?.role !== "ADMIN") notFound();
  const role = await liveRole(session?.user, s, now);
  if (!s.course.published && role !== "host") notFound();
  // Every STUDENT account is treated as under 18, so a guardian must have consented first.
  const consent = role === "student" && session?.user ? await hasGuardianConsent(session.user.id) : true;

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

    // A guardian must consent once, before the student joins any live lecture.
    if (!consent) {
      return (
        <Notice>
          <p className="font-semibold">{t("consentTitle")}</p>
          <p className="text-small">{t("consentBody")}</p>
          <p className="text-small text-ink-muted">{t("consentParent")}</p>
          {exits}
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

    if (!s!.roomUrl) {
      return (
        <Notice>
          <p>{t("noLinkYet")}</p>
          {exits}
        </Notice>
      );
    }

    // One device per account, as for recorded lectures; the teacher may host from anywhere.
    const device = role === "student" ? await oneDevice(session.user.id, path) : null;
    if (device && "block" in device) return device.block;
    if (role === "student") {
      // Records that the link was opened, not how long the student stayed: the meeting is elsewhere.
      await db.liveAttendance.upsert({
        where: { userId_liveSessionId: { userId: session.user.id, liveSessionId: s!.id } },
        create: { userId: session.user.id, liveSessionId: s!.id },
        update: {},
      });
    }
    const provider = meetingProvider(s!.roomUrl) ?? "Zoom";
    void logEventLater({ name: "live_joined", userId: session.user.id, courseId: s!.courseId, props: { role } });
    return (
      <div className="grid place-items-center gap-4 p-6 text-center">
        <p className="max-w-[45ch] text-small text-ink-muted">{t("joinExternal", { provider })}</p>
        <a href={s!.roomUrl} target="_blank" rel="noopener noreferrer" className={primaryButton}>
          {t(role === "host" ? "joinCtaHost" : "joinCta", { provider })}
        </a>
        {role === "student" && <p className="max-w-[45ch] text-small text-ink-muted">{t("joinHonest")}</p>}
      </div>
    );
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
      <div className={`grid min-h-80 place-items-center overflow-hidden card ${liveNow ? "border-pen" : "border-hairline"}`}>
        {await stage()}
      </div>
    </main>
  );
}
