import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/staff";
import { AdminNav, panel, table } from "../AdminNav";

export const dynamic = "force-dynamic";

const DAYS = 30;

/** Cumulative funnel: an actor counts at a step only if they did every earlier step too. */
function funnel(events: { name: string; userId: string | null; sessionId: string | null }[], steps: string[]) {
  let previous: Set<string> | null = null;
  return steps.map((name) => {
    const here = new Set(
      events.filter((e) => e.name === name).map((e) => e.userId ?? e.sessionId).filter((x): x is string => !!x),
    );
    const current = previous ? new Set([...here].filter((x) => previous!.has(x))) : here;
    previous = current;
    return { name, count: current.size };
  });
}

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin/analytics", "office", { key: "nav.analytics", noindex: true });
}

export default async function AnalyticsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("office");

  const since = new Date(Date.now() - DAYS * 86_400_000);
  const events = await db.analyticsEvent.findMany({
    where: { createdAt: { gte: since } },
    select: { name: true, userId: true, sessionId: true },
  });

  const funnels = [
    { key: "signup", steps: ["signup_viewed", "signup_completed"] },
    { key: "purchase", steps: ["course_viewed", "checkout_started", "order_paid"] },
    { key: "teacher", steps: ["invite_accepted", "course_created", "course_published"] },
    { key: "engagement", steps: ["course_viewed", "lesson_opened"] },
  ].map((f) => ({ ...f, rows: funnel(events, f.steps) }));

  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 py-12">
      <AdminNav current="analytics" />
      <p className="text-small text-ink-muted">{t("analyticsHint", { days: DAYS })}</p>

      {funnels.map((f) => (
        <section key={f.key} className={`${panel} overflow-x-auto`}>
          <h2 className="font-display text-h3 font-semibold">{t(`funnels.${f.key}`)}</h2>
          <table className={table}>
            <thead>
              <tr>
                <th scope="col">{t("step")}</th>
                <th scope="col">{t("people")}</th>
                <th scope="col">{t("dropOff")}</th>
              </tr>
            </thead>
            <tbody>
              {f.rows.map((row, i) => {
                const prev = f.rows[i - 1]?.count ?? row.count;
                const drop = i === 0 || prev === 0 ? null : Math.round((1 - row.count / prev) * 100);
                return (
                  <tr key={row.name}>
                    <td className="num" dir="ltr">
                      {row.name}
                    </td>
                    <td className="num">{row.count}</td>
                    <td className="num">{drop === null ? "—" : `${drop}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </main>
  );
}
