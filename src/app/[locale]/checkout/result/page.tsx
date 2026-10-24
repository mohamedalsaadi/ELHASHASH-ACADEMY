import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { stripe, syncCheckoutSession } from "@/lib/stripe";

// Paymob redirects here after the hosted checkout. The status shown comes from our database
// (set by the webhook), never from the redirect's query string, which the browser can edit.
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
  if (!session?.user) redirect(`/${locale}/signin`);
  let order = orderId ? await db.order.findFirst({ where: { id: orderId, userId: session.user.id } }) : null;
  if (!order) redirect(`/${locale}`);

  // The webhook may land after the student is back here (or not at all in local dev), so ask Stripe directly.
  if (order.status === "PENDING" && order.gateway === "STRIPE" && order.gatewayOrderId) {
    const cs = await stripe().checkout.sessions.retrieve(order.gatewayOrderId);
    await syncCheckoutSession(cs, `stripe:${cs.id}:${cs.status}:${cs.payment_status}`);
    order = await db.order.findUniqueOrThrow({ where: { id: order.id } });
  }

  const tone = { PAID: "text-up", PENDING: "text-ink", FAILED: "text-down", EXPIRED: "text-down", REFUNDED: "text-ink-muted" }[order.status];

  return (
    <main className="mx-auto grid max-w-xl gap-4 px-4 py-16">
      <h1 className={`font-display text-h1 font-semibold ${tone}`}>{t(`status.${order.status}`)}</h1>
      <p className="text-ink-muted">{t(`detail.${order.status}`)}</p>
      {order.status === "PENDING" && order.kioskRef && (
        <p className="rounded-md border border-hairline bg-surface p-4">
          {t("kioskRef")} <span className="num font-semibold text-pen">{order.kioskRef}</span>
        </p>
      )}
      <p className="num text-small text-ink-muted">
        {formatMoney(order.total, order.currency, locale)} · {order.id}
      </p>
    </main>
  );
}
