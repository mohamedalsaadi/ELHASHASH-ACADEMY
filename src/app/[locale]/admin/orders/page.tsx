import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/brand/Mark";
import { Link } from "@/i18n/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { requireAdmin } from "@/lib/staff";
import { AdminNav, panel, table } from "../AdminNav";
import { field, label } from "../styles";

export const dynamic = "force-dynamic";

const PAGE = 50;
const STATUSES = ["PENDING", "PAID", "FAILED", "EXPIRED", "REFUNDED"] as const;
const GATEWAYS = ["PAYMOB", "STRIPE", "MANUAL"] as const;
const button = "min-h-11 rounded-sm border border-ink-muted px-4 font-display font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/admin/orders", "office", { key: "nav.orders", noindex: true });
}

export default async function OrdersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string; gateway?: string; page?: string }> }) {
  const { locale } = await params;
  const f = await searchParams;
  setRequestLocale(locale);
  await requireAdmin();
  const t = await getTranslations("office");
  const tm = await getTranslations("checkout");
  const ar = locale === "ar";
  const page = Math.max(1, Number(f.page) || 1);
  const status = STATUSES.find((s) => s === f.status);
  const gateway = GATEWAYS.find((g) => g === f.gateway);
  const where: Prisma.OrderWhereInput = { ...(status && { status }), ...(gateway && { gateway }) };
  const [orders, total] = await Promise.all([
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { user: { select: { id: true, name: true } } } }),
    db.order.count({ where }),
  ]);
  const date = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dubai" });
  const query = (p: number) => new URLSearchParams({ ...(status && { status }), ...(gateway && { gateway }), page: String(p) }).toString();

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-12">
      <AdminNav current="orders" />
      <form className="flex flex-wrap items-end gap-3">
        <label className={label}>
          {t("status")}
          <select name="status" defaultValue={status ?? ""} className={field}>
            <option value="">{t("all")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`orderStatus.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          {t("gateway")}
          <select name="gateway" defaultValue={gateway ?? ""} className={field}>
            <option value="">{t("all")}</option>
            {GATEWAYS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <button className={button}>{t("filter")}</button>
      </form>

      <section className={`${panel} overflow-x-auto`}>
        {orders.length === 0 ? (
          <EmptyState>
            <p className="text-ink-muted">{t("noOrders")}</p>
          </EmptyState>
        ) : (
        <table className={table}>
          <thead>
            <tr>
              <th scope="col">{t("date")}</th>
              <th scope="col">{t("student")}</th>
              <th scope="col">{t("status")}</th>
              <th scope="col">{t("gateway")}</th>
              <th scope="col">{t("amount")}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="num">
                  <Link href={`/admin/orders/${o.id}`} className="text-pen underline-offset-4 hover:underline">
                    {date.format(o.createdAt)}
                  </Link>
                </td>
                <td>
                  <Link href={`/admin/subscribers/${o.user.id}`} className="underline-offset-4 hover:underline">
                    {o.user.name}
                  </Link>
                </td>
                <td className={o.status === "PAID" ? "font-semibold text-up" : o.status === "PENDING" ? "" : "text-ink-muted"}>{t(`orderStatus.${o.status}`)}</td>
                <td>
                  {o.gateway}
                  {o.method ? ` · ${tm(`methods.${o.method}.name`)}` : ""}
                </td>
                <td className="num">{formatMoney(o.total, o.currency, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
        <p className="flex flex-wrap items-center gap-4 text-small text-ink-muted">
          <span>{t("pageOf", { shown: orders.length, total, page })}</span>
          {page > 1 && (
            <Link href={`/admin/orders?${query(page - 1)}`} className="text-pen">
              {t("prev")}
            </Link>
          )}
          {page * PAGE < total && (
            <Link href={`/admin/orders?${query(page + 1)}`} className="text-pen">
              {t("next")}
            </Link>
          )}
        </p>
      </section>
    </main>
  );
}
