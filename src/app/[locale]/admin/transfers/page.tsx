import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { requireAdmin } from "@/lib/staff";
import { AdminNav, panel, table } from "../AdminNav";
import { dismissBankEmail, matchBankEmailManually } from "./actions";

export const dynamic = "force-dynamic";

const button =
  "rounded-sm border border-ink-muted px-3 py-1.5 font-display text-small font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin/transfers", "office", { key: "nav.transfers", noindex: true });
}

export default async function TransfersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("office");

  const [queue, audit, pending] = await Promise.all([
    db.bankEmail.findMany({ where: { status: "NEEDS_REVIEW" }, orderBy: { receivedAt: "desc" }, take: 50 }),
    db.bankEmail.findMany({
      where: { status: { in: ["AUTO_APPROVED", "MATCHED", "REJECTED", "DUPLICATE"] } },
      orderBy: { receivedAt: "desc" },
      take: 50,
    }),
    db.order.findMany({
      where: { status: "PENDING", gateway: "MANUAL" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, total: true, vat: true, currency: true, user: { select: { name: true } } },
    }),
  ]);

  const date = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dubai",
  });
  const money = (n: number | null, currency: string | null) =>
    n === null || !currency ? "—" : formatMoney(n, currency as never, locale);

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-12">
      <AdminNav current="transfers" />

      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-semibold">{t("transfers.queue")}</h2>
        {queue.length === 0 ? (
          <EmptyState>
            <p className="text-ink-muted">{t("transfers.emptyQueue")}</p>
          </EmptyState>
        ) : (
          <ul className="grid gap-3">
            {queue.map((e) => {
              const suggestions = pending
                .filter((o) => o.currency === e.currency && o.total + o.vat === e.amount)
                .slice(0, 3);
              return (
                <li key={e.id} className={panel}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid min-w-0 gap-0.5">
                      <span className="num text-label text-ink-muted">{date.format(e.receivedAt)}</span>
                      <span className="font-semibold">{e.subject || t("transfers.noSubject")}</span>
                      <span className="truncate text-small text-ink-muted" dir="ltr">{e.fromAddress}</span>
                    </div>
                    <div className="grid gap-0.5 text-end">
                      <span className="num font-display text-h3 font-semibold">{money(e.amount, e.currency)}</span>
                      <span className="text-label text-ink-muted">{e.senderName || "—"}</span>
                    </div>
                  </div>

                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-small">
                    <dt className="text-ink-muted">{t("transfers.reference")}</dt>
                    <dd className="num break-all" dir="ltr">{e.reference || "—"}</dd>
                    <dt className="text-ink-muted">{t("transfers.reason")}</dt>
                    <dd className="num" dir="ltr">{e.reason || "—"}</dd>
                  </dl>

                  {e.bodyText && (
                    <details className="text-small">
                      <summary className="cursor-pointer text-pen">{t("transfers.body")}</summary>
                      <pre dir="auto" className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-sm bg-raised p-3 text-label">
                        {e.bodyText}
                      </pre>
                    </details>
                  )}

                  {suggestions.length > 0 && (
                    <div className="grid gap-2 border-t border-hairline pt-3">
                      <p className="text-label text-ink-muted">{t("transfers.suggested")}</p>
                      {suggestions.map((o) => (
                        <form key={o.id} action={matchBankEmailManually} className="flex flex-wrap items-center justify-between gap-2">
                          <input type="hidden" name="id" value={e.id} />
                          <input type="hidden" name="orderId" value={o.id} />
                          <span className="text-small">
                            {o.user.name} · <span className="num">{formatMoney(o.total + o.vat, o.currency, locale)}</span>
                          </span>
                          <button className={button}>{t("transfers.match")}</button>
                        </form>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-end justify-between gap-3 border-t border-hairline pt-3">
                    <form action={matchBankEmailManually} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={e.id} />
                      <label className="grid gap-1 text-small">
                        {t("transfers.pickOrder")}
                        <select name="orderId" required className="min-w-56 rounded-sm border border-rule bg-surface px-3 py-2">
                          {pending.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.user.name} · {formatMoney(o.total + o.vat, o.currency, locale)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button className={button}>{t("transfers.match")}</button>
                    </form>
                    <form action={dismissBankEmail}>
                      <input type="hidden" name="id" value={e.id} />
                      <button className={`${button} border-down text-down`}>{t("transfers.dismiss")}</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-h2 font-semibold">{t("transfers.audit")}</h2>
        {audit.length === 0 ? (
          <EmptyState>
            <p className="text-ink-muted">{t("transfers.emptyAudit")}</p>
          </EmptyState>
        ) : (
          <div className={`${panel} overflow-x-auto`}>
            <table className={table}>
              <thead>
                <tr>
                  <th scope="col">{t("transfers.received")}</th>
                  <th scope="col">{t("transfers.status")}</th>
                  <th scope="col">{t("transfers.amount")}</th>
                  <th scope="col">{t("transfers.from")}</th>
                  <th scope="col">{t("transfers.order")}</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((e) => (
                  <tr key={e.id}>
                    <td className="num">{date.format(e.receivedAt)}</td>
                    <td className="num" dir="ltr">{e.status}</td>
                    <td className="num">{money(e.amount, e.currency)}</td>
                    <td className="truncate text-small" dir="ltr">{e.fromAddress}</td>
                    <td>
                      {e.orderId ? (
                        <Link href={`/admin/orders/${e.orderId}`} className="text-pen underline-offset-4 hover:underline">
                          {t("transfers.order")}
                        </Link>
                      ) : (
                        <span className="text-ink-muted" dir="ltr">{e.reason || "—"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
