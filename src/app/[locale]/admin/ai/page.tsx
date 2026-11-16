import { getTranslations, setRequestLocale } from "next-intl/server";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { AI_MODEL, aiEnabled } from "@/lib/ai";
import { briefingLines, gatherBriefing } from "@/lib/briefing";
import { db } from "@/lib/db";
import { githubConfigured, prUrl } from "@/lib/coworker/github";
import { pageMetadata } from "@/lib/seo";
import { requireAdmin } from "@/lib/staff";
import { AdminNav, panel, table } from "../AdminNav";
import { runCoworkerNow, sendBriefingNow, sendSentryTest, setCoworkerAutoMerge, setCoworkerPaused } from "./actions";

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

  const [briefing, usage, control, cases] = await Promise.all([
    gatherBriefing(),
    db.aiRun.groupBy({ by: ["kind", "status"], where: { createdAt: { gte: since } }, _count: true, _sum: { tokensIn: true, tokensOut: true } }),
    db.coworkerControl.findUnique({ where: { id: "singleton" } }),
    db.coworkerCase.findMany({ orderBy: { updatedAt: "desc" }, take: 25 }),
  ]);
  const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Dubai" });
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
        <p className="text-small">{process.env.SENTRY_DSN ? t("sentryOn") : t("sentryOff")}</p>
        {process.env.SENTRY_DSN && (
          <form action={sendSentryTest}>
            <SubmitButton pendingLabel={t("sending")} className="btn btn-outline w-fit text-small">{t("sentryTest")}</SubmitButton>
          </form>
        )}
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
        <h2 className="font-display text-h3 font-semibold">{t("coworker.title")}</h2>
        <p className="text-small text-ink-muted">{t("coworker.hint")}</p>
        <ul className="list-disc ps-5 text-small">
          <li>{githubConfigured() ? t("coworker.tokenOn") : t("coworker.tokenOff")}</li>
          <li>{control?.paused ? t("coworker.paused") : t("coworker.running")}</li>
          <li>{control?.autoMerge ? t("coworker.autoOn") : t("coworker.autoOff")}</li>
        </ul>
        <div className="flex flex-wrap gap-3">
          <form action={setCoworkerPaused}>
            <input type="hidden" name="paused" value={control?.paused ? "0" : "1"} />
            <SubmitButton pendingLabel={t("sending")} className="btn btn-outline w-fit text-small">{control?.paused ? t("coworker.resume") : t("coworker.pause")}</SubmitButton>
          </form>
          <form action={setCoworkerAutoMerge}>
            <input type="hidden" name="autoMerge" value={control?.autoMerge ? "0" : "1"} />
            <SubmitButton pendingLabel={t("sending")} className="btn btn-outline w-fit text-small">{control?.autoMerge ? t("coworker.autoDisable") : t("coworker.autoEnable")}</SubmitButton>
          </form>
          <form action={runCoworkerNow}>
            <SubmitButton pendingLabel={t("sending")} className="btn btn-primary w-fit text-small">{t("coworker.runNow")}</SubmitButton>
          </form>
        </div>
        <h3 className="font-display text-h4 font-semibold">{t("coworker.cases")}</h3>
        {cases.length === 0 ? (
          <p className="text-small text-ink-muted">{t("coworker.noCases")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th>{t("coworker.caseWhen")}</th>
                  <th>{t("coworker.caseWhat")}</th>
                  <th>{t("coworker.caseStatus")}</th>
                  <th>{t("coworker.caseTimes")}</th>
                  <th>{t("coworker.caseResult")}</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap" dir="ltr">{when.format(c.lastSeenAt)}</td>
                    <td dir="ltr" className="break-words">{c.kind === "REVERT" ? "↩ " : ""}{c.summary}</td>
                    <td>{t(`coworker.status.${c.status}` as "coworker.status.OPEN")}</td>
                    <td className="num">{n(c.count)}</td>
                    <td dir="auto" className="break-words">
                      {c.prNumber ? (
                        <a href={prUrl(c.prNumber)} className="text-pen underline-offset-4 hover:underline" dir="ltr">#{c.prNumber}</a>
                      ) : null}{" "}
                      {c.note ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-label text-ink-muted">{t("coworker.limits")}</p>
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
