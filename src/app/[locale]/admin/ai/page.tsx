import { getTranslations, setRequestLocale } from "next-intl/server";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { AI_MODEL, aiEnabled } from "@/lib/ai";
import { briefingLines, gatherBriefing } from "@/lib/briefing";
import { db } from "@/lib/db";
import { pageMetadata } from "@/lib/seo";
import { requireAdmin } from "@/lib/staff";
import { AdminNav, panel, table } from "../AdminNav";
import { sendBriefingNow } from "./actions";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin/ai", "office", { key: "nav.ai", noindex: true });
}

/** The owner desk for the AI coworkers: is AI on, what the briefing says right now, and what each kind of run has used. */
export default async function AdminAiPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("office.ai");
  const loc = locale === "en" ? "en" : "ar";
  const since = new Date(Date.now() - 30 * 86_400_000);

  const [briefing, usage] = await Promise.all([
    gatherBriefing(),
    db.aiRun.groupBy({ by: ["kind", "status"], where: { createdAt: { gte: since } }, _count: true, _sum: { tokensIn: true, tokensOut: true } }),
  ]);
  const kinds = [...new Set(usage.map((u) => u.kind))].sort();
  const sum = (kind: string, status?: string) => usage.filter((u) => u.kind === kind && (!status || u.status === status));
  const n = (v: number) => new Intl.NumberFormat("en-GB").format(v);

  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 py-12">
      <AdminNav current="ai" />
      <p className="text-small text-ink-muted">{t("hint")}</p>

      <section className={panel}>
        <h2 className="font-display text-h3 font-semibold">{t("status")}</h2>
        <p className="text-small">{aiEnabled() ? t("on", { model: AI_MODEL }) : t("off")}</p>
      </section>

      <section className={panel}>
        <h2 className="font-display text-h3 font-semibold">{t("briefing")}</h2>
        <ul className="list-disc ps-5 text-small">
          {briefingLines(briefing, loc).map((l) => (
            <li key={l} dir="auto">{l}</li>
          ))}
        </ul>
        <form action={sendBriefingNow}>
          <SubmitButton pendingLabel={t("sending")} className="btn btn-primary w-fit text-small">{t("sendNow")}</SubmitButton>
        </form>
        <p className="text-label text-ink-muted">{t("schedule")}</p>
      </section>

      <section className={panel}>
        <h2 className="font-display text-h3 font-semibold">{t("usage")}</h2>
        {kinds.length === 0 ? (
          <p className="text-small text-ink-muted">{t("noRuns")}</p>
        ) : (
          <table className={table}>
            <thead>
              <tr>
                <th>{t("kind")}</th>
                <th>{t("calls")}</th>
                <th>{t("errors")}</th>
                <th>{t("tokensIn")}</th>
                <th>{t("tokensOut")}</th>
              </tr>
            </thead>
            <tbody>
              {kinds.map((k) => (
                <tr key={k}>
                  <td>{t(`kinds.${k}` as "kinds.briefing")}</td>
                  <td className="num">{n(sum(k).reduce((a, u) => a + u._count, 0))}</td>
                  <td className="num">{n(sum(k, "ERROR").reduce((a, u) => a + u._count, 0))}</td>
                  <td className="num">{n(sum(k).reduce((a, u) => a + (u._sum.tokensIn ?? 0), 0))}</td>
                  <td className="num">{n(sum(k).reduce((a, u) => a + (u._sum.tokensOut ?? 0), 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-label text-ink-muted">{t("usageNote")}</p>
      </section>
    </main>
  );
}
