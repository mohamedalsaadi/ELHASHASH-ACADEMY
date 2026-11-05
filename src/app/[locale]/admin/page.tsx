import { pick } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { courseZone, formatMoney, formatWhen } from "@/lib/format";
import { requireAdmin } from "@/lib/staff";
import { AdminNav, panel, stat, table } from "./AdminNav";
import { PasswordForm } from "./ui";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin", "admin", { key: "title", noindex: true });
}

export default async function AdminOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("office");
  const ta = await getTranslations("admin");
  const ar = locale === "ar";
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const current = { startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] };

  const [revenue, subscribers, newStudents, rentals, live, kiosk, requests, tickets] = await Promise.all([
    // SALE and REFUND rows together, so a refund reduces the month it reverses.
    db.ledgerEntry.groupBy({ by: ["currency"], where: { createdAt: { gte: monthStart } }, _sum: { gross: true, platformFee: true }, _count: true }),
    db.entitlement.findMany({ where: { lessonId: null, liveSessionId: null, ...current }, distinct: ["userId"], select: { userId: true } }),
    db.user.count({ where: { role: "STUDENT", createdAt: { gt: new Date(now.getTime() - 7 * DAY) } } }),
    db.entitlement.count({ where: { lessonId: { not: null }, ...current } }),
    db.liveSession.findMany({
      where: { cancelledAt: null, startsAt: { gt: now } },
      orderBy: { startsAt: "asc" },
      take: 8,
      include: { course: { include: { grade: { include: { country: true } } } }, _count: { select: { entitlements: true } } },
    }),
    db.order.findMany({ where: { status: "PENDING", method: "KIOSK" }, orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, name: true } } } }),
    db.specialRequest.count({ where: { status: "OPEN" } }),
    db.supportTicket.count({ where: { status: "OPEN" } }),
  ]);

  const stats: { n: number; l: string; alert?: boolean; href?: string }[] = [
    { n: subscribers.length, l: t("activeSubscribers"), href: "/admin/subscribers" },
    { n: newStudents, l: t("newStudents") },
    { n: rentals, l: t("activeRentals") },
    { n: kiosk.length, l: t("pendingKiosk"), alert: kiosk.length > 0 },
    { n: requests, l: t("openRequests"), alert: requests > 0, href: "/admin/requests" },
    { n: tickets, l: t("openTickets"), alert: tickets > 0, href: "/admin/support" },
  ];

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-12">
      <AdminNav current="overview" />

      <section className={panel}>
        <h2 className="font-display text-h3 font-semibold">{t("revenue")}</h2>
        {revenue.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {revenue.map((r) => (
              <li key={r.currency} className="grid gap-0.5 rounded-md bg-raised px-3 py-2">
                <span className="num font-display text-h3 font-semibold">{formatMoney(r._sum.gross ?? 0, r.currency, locale)}</span>
                <span className="text-label text-ink-muted">{t("orders", { count: r._count })}</span>
                <span className="num text-label text-ink-muted">{formatMoney(r._sum.platformFee ?? 0, r.currency, locale)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small text-ink-muted">{t("noRevenue")}</p>
        )}
      </section>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((s) => {
          const body = (
            <>
              <span className={`num font-display text-h2 font-semibold ${s.alert ? "text-pen" : ""}`}>{s.n}</span>
              <span className="text-label text-ink-muted">{s.l}</span>
            </>
          );
          return (
            <li key={s.l} className={`${stat} ${s.alert ? "ring-2 ring-pen" : ""}`}>
              {s.href ? (
                <Link href={s.href} className="grid gap-0.5 hover:text-pen">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("upcomingLive")}</h2>
          {live.length ? (
            <div className="overflow-x-auto">
              <table className={table}>
                <thead>
                  <tr>
                    <th scope="col">{t("lecture")}</th>
                    <th scope="col">{t("when")}</th>
                    <th scope="col">{t("seats")}</th>
                  </tr>
                </thead>
                <tbody>
                  {live.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <span className="grid">
                          <span className="font-medium">{pick(ar, l.titleAr, l.titleEn)}</span>
                          <span className="text-label text-ink-muted">{pick(ar, l.course.titleAr, l.course.titleEn)}</span>
                        </span>
                      </td>
                      <td className="text-label">{formatWhen(l.startsAt, courseZone(l.course), locale)}</td>
                      <td className="num">{l._count.entitlements}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-small text-ink-muted">{t("noLive")}</p>
          )}
        </section>

        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("pendingKiosk")}</h2>
          {kiosk.length ? (
            <ul className="grid gap-2 text-small">
              {kiosk.map((o) => (
                <li key={o.id} className="flex items-baseline justify-between gap-3 border-b border-dashed border-rule pb-2">
                  <Link href={`/admin/subscribers/${o.user.id}`} className="text-pen underline-offset-4 hover:underline">
                    {o.user.name}
                  </Link>
                  <Link href={`/admin/orders/${o.id}`} className="num">
                    {formatMoney(o.total, o.currency, locale)}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>
              <p className="text-small text-ink-muted">{t("noKiosk")}</p>
            </EmptyState>
          )}
        </section>
      </div>

      <section className="grid gap-3">
        <h2 className="font-display text-h3 font-semibold">{ta("changePassword")}</h2>
        <PasswordForm />
      </section>
    </main>
  );
}
