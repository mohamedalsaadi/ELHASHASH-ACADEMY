import { pageMetadata } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { getBankDetails } from "@/lib/platform-settings";
import { stripe, syncCheckoutSession } from "@/lib/stripe";
import { syncPaymentIntent } from "@/lib/ziina";
import { PendingPoll } from "./PendingPoll";
import { ReceiptUpload } from "./ReceiptUpload";

// Paymob redirects here after the hosted checkout. The status shown comes from our database
// (set by the webhook), never from the redirect's query string, which the browser can edit.
export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/checkout", "checkout", { key: "title", noindex: true });
}

export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const { locale } = await params;
  const { order: orderId } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("checkout.result");

  const session = await auth();
  if (!session?.user) {
    const back = `/${locale}/checkout/result${orderId ? `?order=${encodeURIComponent(orderId)}` : ""}`;
    redirect(`/${locale}/signin?next=${encodeURIComponent(back)}`);
  }

  let order = orderId
    ? await db.order.findFirst({
        where: { id: orderId, userId: session.user.id },
        include: { items: { select: { skuId: true } } },
      })
    : null;
  if (!order) redirect(`/${locale}`);

  // The webhook may land after the student is back here (or not at all in local dev), so ask Stripe directly.
  if (order.status === "PENDING" && order.gateway === "STRIPE" && order.gatewayOrderId) {
    const cs = await stripe().checkout.sessions.retrieve(order.gatewayOrderId);
    await syncCheckoutSession(cs, `stripe:${cs.id}:${cs.status}:${cs.payment_status}`);
    order = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: { select: { skuId: true } } } });
  }

  // Ziina's webhook cannot be trusted for shape, so the return page is the primary settlement
  // path; the webhook is the backstop. Both settle through the same idempotent event id.
  if (order.status === "PENDING" && order.gateway === "ZIINA" && order.gatewayOrderId) {
    await syncPaymentIntent(order).catch((e) => console.error("[ziina] result sync failed", order!.id, e));
    order = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: { select: { skuId: true } } } });
  }

  const ar = locale === "ar";
  const transfer = order.status === "PENDING" && order.gateway === "MANUAL" ? await getBankDetails() : null;
  const tone = { PAID: "text-up", PENDING: "text-ink", FAILED: "text-down", EXPIRED: "text-down", REFUNDED: "text-ink-muted" }[order.status];
  const retryPath = order.items.length ? `/checkout?${order.items.map((i) => `sku=${encodeURIComponent(i.skuId)}`).join("&")}` : "/courses";
  const primaryButton =
    "w-fit rounded-sm border border-hairline bg-surface px-4 py-2 font-display text-small font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-marker";

  return (
    <main className="mx-auto grid max-w-xl gap-4 px-4 py-16">
      <h1 className={`font-display text-h1 font-semibold ${tone}`}>{t(`status.${order.status}`)}</h1>
      <p className="text-ink-muted">{t(`detail.${order.status}`)}</p>
      {order.status === "PENDING" && order.kioskRef && (
        <p className="rounded-md border border-hairline bg-surface p-4">
          {t("kioskRef")} <span className="num font-semibold text-pen">{order.kioskRef}</span>
        </p>
      )}
      {order.status === "PENDING" && order.gateway !== "MANUAL" && <PendingPoll />}
      <p className="num text-small text-ink-muted">{formatMoney(order.total + order.vat, order.currency, locale)}</p>
      <p className="text-small text-ink-muted">
        {t("reference")} <span className="num" dir="ltr">{order.id}</span>
      </p>

      {transfer && (
        <section className="grid gap-3 rounded-md border border-hairline bg-surface p-4">
          <h2 className="font-display text-h3 font-semibold">{t("transfer.title")}</h2>
          <p className="text-small text-ink-muted">{t("transfer.hint", { amount: formatMoney(order.total + order.vat, order.currency, locale) })}</p>
          <dl className="num grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-small" dir="ltr">
            {transfer.bankName && (
              <>
                <dt className="text-ink-muted">{t("transfer.bank")}</dt>
                <dd>{transfer.bankName}</dd>
              </>
            )}
            {transfer.bankAccountName && (
              <>
                <dt className="text-ink-muted">{t("transfer.account")}</dt>
                <dd>{transfer.bankAccountName}</dd>
              </>
            )}
            <dt className="text-ink-muted">{t("transfer.iban")}</dt>
            <dd className="break-all font-semibold">{transfer.bankIban}</dd>
            <dt className="text-ink-muted">{t("transfer.reference")}</dt>
            <dd className="break-all">{order.id}</dd>
          </dl>
          {(ar ? transfer.bankInstructionsAr : transfer.bankInstructionsEn) && (
            <p className="text-small text-ink-muted" dir="auto">{ar ? transfer.bankInstructionsAr : transfer.bankInstructionsEn}</p>
          )}
          <ReceiptUpload
            orderId={order.id}
            pathPrefix={`receipts/${order.id}/`}
            hasReceipt={!!order.receiptKey}
            labels={{
              title: t("transfer.receiptTitle"),
              hint: t("transfer.receiptHint"),
              file: t("transfer.receiptFile"),
              uploading: t("transfer.uploading"),
              saved: t("transfer.receiptSaved"),
              failed: t("transfer.receiptFailed"),
              replace: t("transfer.receiptReplace"),
            }}
          />
        </section>
      )}
      <div className="flex flex-wrap gap-3">
        {(order.status === "PAID" || order.status === "REFUNDED") && (
          <Link href={`/orders/${order.id}`} className={primaryButton}>
            {t("receipt")}
          </Link>
        )}
        {(order.status === "FAILED" || order.status === "EXPIRED") && (
          <Link href={retryPath} className={primaryButton}>
            {t("retry")}
          </Link>
        )}
        {order.status === "PAID" && (
          <Link href="/dashboard" className={primaryButton}>
            {t("dashboard")}
          </Link>
        )}
        {(order.status === "FAILED" || order.status === "EXPIRED") && (
          <Link href="/contact" className="w-fit text-small text-pen underline-offset-4 hover:underline">
            {t("contact")}
          </Link>
        )}
      </div>
    </main>
  );
}
