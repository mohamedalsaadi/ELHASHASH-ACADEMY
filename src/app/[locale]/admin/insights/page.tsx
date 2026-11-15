import { getTranslations, setRequestLocale } from "next-intl/server";
import { Columns, HBars, Kpi, LineChart, fmt } from "@/components/admin/Charts";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/content";
import { formatMoney, minorPerUnit } from "@/lib/format";
import { loadInsights, weakSpots } from "@/lib/insights";
import type { Currency } from "@/lib/pricing-engine";
import { pageMetadata } from "@/lib/seo";
import { requireAdmin } from "@/lib/staff";
import { AdminNav, panel, table } from "../AdminNav";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90] as const;

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin/insights", "office", { key: "nav.insights", noindex: true });
}

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

/** The owner's statistics desk: how people join, learn, buy and get stuck, with charts, and a short list of what needs attention. */
export default async function InsightsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ days?: string }> }) {
  const { locale } = await params;
  const { days: rawDays } = await searchParams;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("office.insights");
  const ar = locale === "ar";
  const days = RANGES.find((d) => String(d) === rawDays) ?? 30;
  const d = await loadInsights(days);
  const weak = weakSpots(d, ar);

  const rated = d.courses.filter((c) => c.rating !== null && c.ratings > 0);
  const ratingCount = rated.reduce((a, c) => a + c.ratings, 0);
  const avgRating = ratingCount ? rated.reduce((a, c) => a + (c.rating ?? 0) * c.ratings, 0) / ratingCount : null;
  const top = d.revenue[0];
  const newStudents = d.signups.reduce((a, p) => a + p.n, 0);
  const paid = d.orders.reduce((a, p) => a + p.n, 0);
  const stepName = (n: string) => t(`steps.${n}` as "steps.course_viewed");
  const countryName = (c: { nameAr: string; nameEn: string }) => pick(ar, c.nameAr, c.nameEn);
  const chip = (on: boolean) => `rounded-full px-3 py-1 text-small ${on ? "bg-surface text-ink shadow-paper" : "text-ink-muted hover:text-ink"}`;
  const empty = t("noData");
  const funnelRows = (rows: { name: string; n: number }[]) =>
    rows.map((r, i) => ({ label: stepName(r.name), value: r.n, text: `${fmt(r.n)}${i > 0 ? ` · ${pct(r.n, rows[i - 1].n)}` : ""}` }));

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-12">
      <AdminNav current="insights" />
      <p className="text-small text-ink-muted">{t("hint")}</p>
      <nav className="flex flex-wrap gap-2" aria-label={t("range")}>
        {RANGES.map((r) => (
          <Link key={r} href={`/admin/insights?days=${r}`} className={chip(r === days)}>{t("lastDays", { days: r })}</Link>
        ))}
      </nav>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={t("kpi.students")} value={fmt(newStudents)} />
        <Kpi label={t("kpi.activated")} value={pct(d.activation.learned, d.activation.total)} hint={t("kpi.activatedHint")} />
        <Kpi label={t("kpi.enrolled")} value={pct(d.activation.enrolled, d.activation.total)} hint={t("kpi.enrolledHint")} />
        <Kpi label={t("kpi.orders")} value={fmt(paid)} />
        <Kpi label={t("kpi.revenue")} value={top ? formatMoney(Math.round(top.total), top.currency as Currency, locale) : "—"} hint={d.revenue.length > 1 ? t("kpi.moreCurrencies", { n: d.revenue.length - 1 }) : undefined} />
        <Kpi label={t("kpi.rating")} value={avgRating === null ? "—" : `${avgRating.toFixed(1)} / 5`} hint={t("kpi.ratingHint", { n: ratingCount })} />
        <Kpi label={t("kpi.tickets")} value={fmt(d.support.open)} alert={d.support.open > 0} />
        <Kpi label={t("kpi.errors")} value={fmt(d.errors.total)} alert={d.errors.total > 0} hint={t("kpi.errorsHint")} />
      </section>

      <section className={panel}>
        <h2 className="font-display text-h3 font-semibold">{t("attention")}</h2>
        {weak.length === 0 ? (
          <p className="text-small text-ink-muted">{t("attentionNone")}</p>
        ) : (
          <ul className="grid list-disc gap-1 ps-5 text-small">
            {weak.map((w, i) => (
              <li key={`${w.key}-${i}`} dir="auto">{t(`weak.${w.key}` as "weak.errors", w.vars)}</li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("signupsPerDay")}</h2>
          <LineChart points={d.signups} label={t("signupsPerDay")} />
        </section>
        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("byCountry")}</h2>
          <HBars rows={d.signupsByCountry.map((c) => ({ label: countryName(c), value: c.n }))} empty={empty} />
        </section>

        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("revenuePerDay", { currency: top?.currency ?? "" })}</h2>
          {top ? <LineChart points={top.series.map((p) => ({ d: p.d, n: p.n / minorPerUnit(top.currency as Currency) }))} label={t("revenuePerDay", { currency: top.currency })} /> : <p className="text-small text-ink-muted">{empty}</p>}
        </section>
        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("ordersPerDay")}</h2>
          <LineChart points={d.orders} label={t("ordersPerDay")} />
        </section>

        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("funnel")}</h2>
          <HBars rows={funnelRows(d.funnel)} empty={empty} />
          <p className="text-label text-ink-muted">{t("funnelNote")}</p>
        </section>
        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("signupFunnel")}</h2>
          <HBars rows={funnelRows(d.signupFunnel)} empty={empty} />
        </section>

        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("playsPerDay")}</h2>
          <LineChart points={d.plays} label={t("playsPerDay")} />
        </section>
        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("playsByHour")}</h2>
          <Columns values={d.playsByHour} labels={d.playsByHour.map((_, h) => String(h))} label={t("playsByHour")} />
          <p className="text-label text-ink-muted">{t("hourNote")}</p>
        </section>

        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("weekly")}</h2>
          {d.weekly.length ? <Columns values={d.weekly.map((w) => w.n)} labels={d.weekly.map((w) => w.d.slice(5))} label={t("weekly")} /> : <p className="text-small text-ink-muted">{empty}</p>}
        </section>
        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("audience")}</h2>
          <HBars rows={d.playsByCountry.map((c) => ({ label: c.code, value: c.n }))} empty={empty} />
          <p className="text-small">{t("mobileShare", { pct: pct(d.mobile.mobile, d.mobile.total) })}</p>
        </section>

        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("ticketsPerDay")}</h2>
          <LineChart points={d.support.daily} label={t("ticketsPerDay")} />
          <p className="text-small">{t("avgReply", { hours: d.support.avgReplyHours === null ? "—" : Math.round(d.support.avgReplyHours) })}</p>
        </section>
        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("errorsPerDay")}</h2>
          <LineChart points={d.errors.daily} label={t("errorsPerDay")} />
          <HBars rows={d.errors.bySource.map((e) => ({ label: e.source, value: e.n }))} empty={t("noErrors")} />
          <Link href="/admin/logs?level=ERROR" className="text-small text-pen underline-offset-4 hover:underline">{t("openLog")}</Link>
        </section>
      </div>

      <section className={`${panel} overflow-x-auto`}>
        <h2 className="font-display text-h3 font-semibold">{t("courses")}</h2>
        {d.courses.length === 0 ? (
          <p className="text-small text-ink-muted">{empty}</p>
        ) : (
          <table className={table}>
            <thead>
              <tr>
                <th scope="col">{t("course")}</th>
                <th scope="col">{t("views")}</th>
                <th scope="col">{t("buyers")}</th>
                <th scope="col">{t("conversion")}</th>
                <th scope="col">{t("completion")}</th>
                <th scope="col">{t("ratingCol")}</th>
              </tr>
            </thead>
            <tbody>
              {d.courses.map((c) => (
                <tr key={c.id}>
                  <td dir="auto">{pick(ar, c.titleAr, c.titleEn)}</td>
                  <td className="num">{fmt(c.views)}</td>
                  <td className="num">{fmt(c.buyers)}</td>
                  <td className="num">{pct(c.buyers, c.views)}</td>
                  <td className="num">{pct(c.completed, c.lessonViews)}</td>
                  <td className="num">{c.rating === null ? "—" : `${c.rating.toFixed(1)} (${c.ratings})`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-label text-ink-muted">{t("coursesNote")}</p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className={`${panel} overflow-x-auto`}>
          <h2 className="font-display text-h3 font-semibold">{t("slowLessons")}</h2>
          {d.slowLessons.length === 0 ? (
            <p className="text-small text-ink-muted">{t("notEnough")}</p>
          ) : (
            <table className={table}>
              <thead><tr><th scope="col">{t("lesson")}</th><th scope="col">{t("views")}</th><th scope="col">{t("completion")}</th></tr></thead>
              <tbody>
                {d.slowLessons.map((l) => (
                  <tr key={l.id}>
                    <td dir="auto"><span className="grid"><span>{pick(ar, l.titleAr, l.titleEn)}</span><span className="text-label text-ink-muted">{pick(ar, l.courseAr, l.courseEn)}</span></span></td>
                    <td className="num">{fmt(l.views)}</td>
                    <td className="num">{pct(l.completed, l.views)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className={`${panel} overflow-x-auto`}>
          <h2 className="font-display text-h3 font-semibold">{t("hardPractice")}</h2>
          {d.hardPractice.length === 0 ? (
            <p className="text-small text-ink-muted">{t("notEnough")}</p>
          ) : (
            <table className={table}>
              <thead><tr><th scope="col">{t("lesson")}</th><th scope="col">{t("attempts")}</th><th scope="col">{t("avgScore")}</th></tr></thead>
              <tbody>
                {d.hardPractice.map((l) => (
                  <tr key={l.id}>
                    <td dir="auto"><span className="grid"><span>{pick(ar, l.titleAr, l.titleEn)}</span><span className="text-label text-ink-muted">{pick(ar, l.courseAr, l.courseEn)}</span></span></td>
                    <td className="num">{fmt(l.attempts)}</td>
                    <td className="num">{Math.round(l.avgPct)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <p className="text-label text-ink-muted">{t("limits")}</p>
    </main>
  );
}
