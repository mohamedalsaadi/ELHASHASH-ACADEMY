import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/orders/${id}`)}`);
  const t = await getTranslations("receipt");
  const tr = await getTranslations("checkout.result");
  const tc = await getTranslations("catalog");
  const ar = locale === "ar";

  const o = await db.order.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, phone: true } },
      coupon: { select: { code: true } },
      items: {
        include: {
          sku: {
            include: {
              course: { select: { titleAr: true, titleEn: true } },
              lesson: { select: { titleAr: true, titleEn: true } },
              liveSession: { select: { titleAr: true, titleEn: true } },
            },
          },
        },
      },
    },
  });
  if (!o || (o.userId !== session.user.id && session.user.role !== "ADMIN")) notFound();

  const name = (x: { titleAr: string; titleEn: string }) => (ar ? x.titleAr : x.titleEn);
  const money = (n: number) => formatMoney(n, o.currency, locale);
  const date = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Dubai" });

  return (
    <main className="mx-auto grid max-w-2xl gap-6 px-4 py-12 print:py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/dashboard" className="text-small text-pen underline-offset-4 hover:underline">
          ← {t("back")}
        </Link>
        <PrintButton label={t("print")} />
      </div>

      <section className="grid gap-5 rounded-md border border-hairline bg-surface p-6 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-4">
          <div className="grid gap-1">
            <h1 className="font-display text-h2 font-semibold">{t("title")}</h1>
            <p className="num text-small text-ink-muted" dir="ltr">
              {o.id}
            </p>
          </div>
          <span className="rounded-full border border-hairline px-3 py-1 text-label font-semibold">{tr(`status.${o.status}`)}</span>
        </header>

        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-small [&_dt]:text-label [&_dt]:text-ink-muted">
          <dt>{t("student")}</dt>
          <dd>{o.user.name}</dd>
          <dt>{t("date")}</dt>
          <dd className="num">{date.format(o.paidAt ?? o.createdAt)}</dd>
          <dt>{t("gateway")}</dt>
          <dd>
            {o.gateway}
            {o.method ? ` · ${o.method}` : ""}
          </dd>
          {o.gatewayOrderId && (
            <>
              <dt>{t("reference")}</dt>
              <dd className="num break-all" dir="ltr">
                {o.gatewayOrderId}
              </dd>
            </>
          )}
        </dl>

        <table className="w-full border-collapse text-small">
          <thead>
            <tr className="border-b border-hairline text-label text-ink-muted">
              <th className="py-2 text-start font-medium">{t("item")}</th>
              <th className="py-2 text-end font-medium">{t("amount")}</th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((i) => (
              <tr key={i.id} className="border-b border-dashed border-rule">
                <td className="py-2">
                  {name(i.sku.liveSession ?? i.sku.lesson ?? i.sku.course)} · {tc(`access.${i.sku.accessType}`, { days: i.sku.accessDays ?? 0 })}
                </td>
                <td className="num py-2 text-end">{money(i.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t border-hairline pt-3">
          <dt className="text-ink-muted">{t("subtotal")}</dt>
          <dd className="num">{money(o.subtotal)}</dd>
          {o.discount > 0 && (
            <>
              <dt className="text-up">
                {t("discount")}
                {o.coupon ? ` · ${o.coupon.code}` : ""}
              </dt>
              <dd className="num text-up">−{money(o.discount)}</dd>
            </>
          )}
          <dt className="font-display font-semibold">{t("total")}</dt>
          <dd className="num font-semibold">{money(o.total)}</dd>
        </dl>

        <p className="text-small text-ink-muted">{t("thanks")}</p>
      </section>
    </main>
  );
}
