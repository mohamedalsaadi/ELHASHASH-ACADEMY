import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { field } from "@/components/ui/form";
import { formatMoney } from "@/lib/format";
import { loadPayouts } from "@/lib/payouts";
import { pageMetadata } from "@/lib/seo";
import { requireAdmin } from "@/lib/staff";
import { AdminNav, panel } from "../AdminNav";
import { markPayoutPaid } from "./actions";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin/payouts", "office", { key: "nav.payouts", noindex: true });
}

/** Teacher statements the owner pays by bank transfer: what is ready, what is waiting on the teacher, what was paid. */
export default async function AdminPayoutsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("payouts");
  const ar = locale === "ar";
  const date = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: "UTC" });
  const all = await loadPayouts();
  const ready = all.filter((s) => s.state === "ready");
  const waiting = all.filter((s) => s.state === "needsAck" || s.state === "needsDetails");
  const paid = all.filter((s) => s.state === "paid").slice(0, 20);
  const totals = new Map<string, number>();
  for (const s of ready) totals.set(s.currency, (totals.get(s.currency) ?? 0) + s.instructorPayout);

  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 py-12">
      <AdminNav current="payouts" />
      <p className="text-small text-ink-muted">{t("hint")}</p>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-h2 font-semibold">{t("ready")}</h2>
          {ready.length > 0 && (
            <a href={`/${locale}/admin/payouts/export`} className="btn btn-outline w-fit text-small">
              {t("csv")}
            </a>
          )}
        </div>
        {ready.length > 0 && <p className="num text-small">{t("total", { total: [...totals].map(([c, n]) => formatMoney(n, c as never, locale)).join(ar ? "، " : ", ") })}</p>}
        {ready.length === 0 ? (
          <EmptyState>
            <p className="text-ink-muted">{t("noneReady")}</p>
          </EmptyState>
        ) : (
          ready.map((s) => (
            <section key={s.id} className={panel}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-display text-h3 font-semibold">{s.instructor.name}</span>
                <span className="num font-display text-h3 font-semibold">{formatMoney(s.instructorPayout, s.currency, locale)}</span>
              </div>
              <p className="num text-label text-ink-muted">
                {s.period} · {s.currency}
                {s.payableAt && ` · ${t("payableOn", { date: date.format(s.payableAt) })}`}
                {s.payableAt && s.payableAt < new Date() && ` · ${t("overdue")}`}
              </p>
              <dl className="grid gap-1 rounded-sm bg-raised p-3 text-small" dir="ltr">
                <div>{s.instructor.payoutHolder}</div>
                <div>{s.instructor.payoutBank}</div>
                <div className="num select-all">{s.instructor.payoutIban}</div>
                <div className="num text-ink-muted">{`DHIRWA-${s.period}`}</div>
              </dl>
              <form action={markPayoutPaid} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={s.id} />
                <label className="grid flex-1 gap-1 text-label sm:min-w-64">
                  {t("reference")}
                  <input name="reference" required minLength={3} maxLength={100} dir="auto" defaultValue={`DHIRWA-${s.period}`} className={field} />
                </label>
                <SubmitButton showSaved={false} className="btn btn-primary w-fit text-small">{t("markPaid")}</SubmitButton>
              </form>
            </section>
          ))
        )}
      </section>

      {waiting.length > 0 && (
        <section className="grid gap-2">
          <h2 className="font-display text-h3 font-semibold">{t("waiting")}</h2>
          <ul className="grid gap-2">
            {waiting.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-sm border border-hairline p-3 text-small">
                <span>{s.instructor.name} · <span className="num">{s.period}</span></span>
                <span className="num">{formatMoney(s.instructorPayout, s.currency, locale)}</span>
                <span className="text-ink-muted">{s.state === "needsAck" ? t("needsAck") : t("needsDetails")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {paid.length > 0 && (
        <section className="grid gap-2">
          <h2 className="font-display text-h3 font-semibold">{t("paid")}</h2>
          <ul className="grid gap-2">
            {paid.map((s) => (
              <li key={s.id} className="num flex flex-wrap items-baseline justify-between gap-2 rounded-sm border border-hairline p-3 text-small">
                <span>{s.instructor.name} · {s.period}</span>
                <span>{formatMoney(s.instructorPayout, s.currency, locale)}</span>
                <span className="text-ink-muted">{date.format(s.paidAt!)} · {s.paidReference}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
