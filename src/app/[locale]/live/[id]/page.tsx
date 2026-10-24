import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Mark } from "@/components/brand/Mark";
import { Notice, oneDevice, secondaryButton } from "@/components/OneDevice";
import { Link } from "@/i18n/navigation";
import { liveRole } from "@/lib/catalog";
import { createRoom, meetingToken } from "@/lib/daily";
import { db } from "@/lib/db";
import { courseZone, formatMoney, formatWhen } from "@/lib/format";
import { Countdown } from "./Countdown";

export const dynamic = "force-dynamic";

const primaryButton =
  "rounded-sm bg-primary px-[18px] py-3 font-display font-semibold text-on-primary transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-[color-mix(in_oklab,var(--color-primary)_86%,#fff)]";

/** Students may enter this long before the start; the teacher 30 minutes. Matches the token windows in lib/daily.ts. */
const LEAD_MIN = { student: 10, host: 30 };

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
    if (s!.cancelledAt) return <Notice>{t("isCancelled")}</Notice>;
    if (now >= endsAt) return <Notice>{t("ended")}</Notice>;
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
                {t("buySeat", { price: formatMoney(seat.price, seat.currency, locale) })}
              </Link>
            )}
            <Link href={`/courses/${s!.course.slug}#packages`} className={secondaryButton}>
              {t("subscribe")}
            </Link>
          </div>
        </Notice>
      );
    }

    const opensAt = new Date(s!.startsAt.getTime() - LEAD_MIN[role] * 60_000);
    if (now < opensAt) {
      return (
        <Notice>
          <p>{t("opensIn")}</p>
          <Countdown at={opensAt.toISOString()} locale={locale} />
          <p className="text-small">{t("opensHint", { minutes: LEAD_MIN[role] })}</p>
        </Notice>
      );
    }

    // One device per account, as for recorded lectures; the teacher may host from anywhere.
    if (role === "student") {
      const device = await oneDevice(session.user.id, path);
      if ("block" in device) return device.block;
    }
    const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { name: true, phone: true } });
    try {
      let roomUrl = s!.roomUrl;
      if (!roomUrl) {
        roomUrl = await createRoom(s!.id, endsAt);
        await db.liveSession.update({ where: { id: s!.id }, data: { roomUrl } });
      }
      const token = await meetingToken({
        sessionId: s!.id,
        userId: session.user.id,
        userName: role === "host" ? user.name : [user.name, user.phone].filter(Boolean).join(" · "),
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

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-12">
      <Link href={`/courses/${s.course.slug}`} className="flex w-fit items-center gap-2 text-small text-ink-muted hover:text-ink">
        <Mark size={16} />
        {ar ? s.course.titleAr : s.course.titleEn}
      </Link>
      <div className="grid gap-1">
        <h1 className="font-display text-h1 font-semibold">{title}</h1>
        <p className="text-small text-ink-muted">
          {formatWhen(s.startsAt, courseZone(s.course), locale)} · {t("minutes", { count: s.durationMin })}
        </p>
      </div>
      <div className="aspect-[3/4] overflow-hidden rounded-md border border-hairline bg-surface sm:aspect-video">{await stage()}</div>
    </main>
  );
}
