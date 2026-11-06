import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import type { Currency } from "@/lib/pricing-engine";
import { requireAdmin } from "@/lib/staff";
import { AdminNav, panel, table } from "../AdminNav";

export const dynamic = "force-dynamic";

/** The five steps a visitor takes, in order. Each person is counted once per day per step (see `dedupeKey`). */
const STEPS = ["course_viewed", "checkout_started", "order_paid", "signup_completed"] as const;

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin/funnel", "office", { key: "nav.funnel", noindex: true });
}

export default async function FunnelPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("office");
  const ar = locale === "ar";
  const since = new Date(Date.now() - 30 * 86_400_000);

  const [events, paidByCurrency] = await Promise.all([
    db.analyticsEvent.groupBy({ by: ["name"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    db.order.groupBy({
      by: ["currency"],
      where: { status: "PAID", paidAt: { gte: since } },
      _count: { _all: true },
      _sum: { total: true, vat: true },
    }),
  ]);

  const count = (name: string) => events.find((e) => e.name === name)?._count._all ?? 0;
  const top = Math.max(1, count("course_viewed"));

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-12">
      <AdminNav current="funnel" />

      <section className={`${panel}`}>
        <h2 className="font-display text-h2 font-semibold">{t("funnelTitle")}</h2>
        <p className="text-small text-ink-muted">{t("funnelHint")}</p>
        <div className="overflow-x-auto">
          <table className={table}>
            <thead>
              <tr>
                <th scope="col">{t("funnelStep")}</th>
                <th scope="col">{t("funnelCount")}</th>
                <th scope="col">{t("funnelRate")}</th>
              </tr>
            </thead>
            <tbody>
              {STEPS.map((step) => {
                const n = count(step);
                return (
                  <tr key={step}>
                    <td>{t(`event.${step}`)}</td>
                    <td className="num">{n}</td>
                    <td className="num">{Math.round((n / top) * 100)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${panel}`}>
        <h2 className="font-display text-h2 font-semibold">{t("funnelPaid")}</h2>
        {paidByCurrency.length === 0 ? (
          <p className="text-small text-ink-muted">{t("funnelNoPaid")}</p>
        ) : (
          <ul className="grid gap-2">
            {paidByCurrency.map((row) => (
              <li key={row.currency} className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="num font-display font-semibold">
                  {formatMoney((row._sum.total ?? 0) + (row._sum.vat ?? 0), row.currency as Currency, locale)}
                </span>
                <span className="text-small text-ink-muted">
                  {row._count._all} {ar ? "طلب مدفوع" : "paid orders"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
