import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { requireAdmin } from "@/lib/staff";
import { markOrderPaid, refundOrder } from "../../actions";
import { AdminNav, panel, table } from "../../AdminNav";
import { SaveButton } from "../../ui";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("office");
  const tc = await getTranslations("catalog");
  const ar = locale === "ar";

  const o = await db.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      items: { include: { sku: { include: { course: { select: { titleAr: true, titleEn: true } }, lesson: { select: { titleAr: true, titleEn: true } } } } } },
      events: { orderBy: { createdAt: "asc" } },
      _count: { select: { entitlements: true } },
    },
  });
  if (!o) notFound();
  const date = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dubai" });
  const name = (x: { titleAr: string; titleEn: string }) => (ar ? x.titleAr : x.titleEn);
  const money = (n: number) => formatMoney(n, o.currency, locale);

  return (
    <main className="mx-auto grid max-w-4xl gap-6 px-4 py-12">
      <AdminNav current="orders" title={`${t(`orderStatus.${o.status}`)} · ${money(o.total)}`} />

      <section className={panel}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-small [&_dt]:text-label [&_dt]:text-ink-muted">
          <dt>{t("student")}</dt>
          <dd>
            <Link href={`/admin/subscribers/${o.user.id}`} className="text-pen underline-offset-4 hover:underline">
              {o.user.name}
            </Link>
          </dd>
          <dt>{t("gateway")}</dt>
          <dd>
            {o.gateway}
            {o.method ? ` · ${o.method}` : ""}
            {o.kioskRef ? ` · ${o.kioskRef}` : ""}
          </dd>
          <dt>{t("date")}</dt>
          <dd className="num">
            {date.format(o.createdAt)}
            {o.paidAt ? ` → ${date.format(o.paidAt)}` : ""}
          </dd>
          <dt>{t("amount")}</dt>
          <dd className="num">
            {money(o.subtotal)}
            {o.discount ? ` − ${money(o.discount)}` : ""} = {money(o.total)}
          </dd>
          <dt>{t("access")}</dt>
          <dd className="num">{o._count.entitlements}</dd>
          {o.gatewayOrderId && (
            <>
              <dt>ID</dt>
              <dd className="num break-all" dir="ltr">
                {o.gatewayOrderId}
              </dd>
            </>
          )}
        </dl>
      </section>

      <section className={`${panel} overflow-x-auto`}>
        <h2 className="font-display text-h3 font-semibold">{t("items")}</h2>
        {o.items.length ? (
          <table className={table}>
            <tbody>
              {o.items.map((i) => (
                <tr key={i.id}>
                  <td>
                    {name(i.sku.course)} · {i.sku.lesson ? name(i.sku.lesson) : tc(`access.${i.sku.accessType}`, { days: i.sku.accessDays ?? 0 })}
                  </td>
                  <td className="num">{money(i.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-small text-ink-muted">{t("extension")}</p>
        )}
      </section>

      {(o.status === "PENDING" || o.status === "PAID") && (
        <section className={panel}>
          <h2 className="font-display text-h3 font-semibold">{t("actions")}</h2>
          {o.status === "PENDING" && (
            <form action={markOrderPaid} className="grid gap-2">
              <input type="hidden" name="id" value={o.id} />
              <p className="text-small text-ink-muted">{t("markPaidHint")}</p>
              <div>
                <SaveButton>{t("markPaid")}</SaveButton>
              </div>
            </form>
          )}
          {o.status === "PAID" && (
            <form action={refundOrder} className="grid gap-2">
              <input type="hidden" name="id" value={o.id} />
              <p className="text-small text-ink-muted">{o.gateway === "PAYMOB" ? t("refundPaymobHint") : t("refundHint")}</p>
              <div>
                <SaveButton danger>{t("refund")}</SaveButton>
              </div>
            </form>
          )}
        </section>
      )}

      <section className={panel}>
        <h2 className="font-display text-h3 font-semibold">{t("events")}</h2>
        {o.events.length ? (
          <ol className="grid gap-3">
            {o.events.map((e) => (
              <li key={e.id} className="grid gap-1">
                <span className="num text-label text-ink-muted">
                  {date.format(e.createdAt)} · <span dir="ltr">{e.gatewayEventId}</span>
                </span>
                <pre dir="ltr" className="max-h-64 overflow-auto rounded-sm bg-raised p-3 text-label">
                  {JSON.stringify(e.payload, null, 2)}
                </pre>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-small text-ink-muted">{t("noEvents")}</p>
        )}
      </section>
    </main>
  );
}
