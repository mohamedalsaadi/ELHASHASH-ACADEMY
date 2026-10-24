import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { activeGateway, priceSkus } from "@/lib/checkout";
import { db } from "@/lib/db";
import { createIntention } from "@/lib/paymob";
import { PricingError } from "@/lib/pricing-engine";
import { checkoutSchema } from "@/lib/schemas/checkout";
import { stripe } from "@/lib/stripe";

// Kiosk orders wait for cash; after this window the reference is treated as expired.
const PENDING_TTL_MS = 72 * 60 * 60 * 1000;
// Stripe allows a Checkout Session to live 30 minutes to 24 hours.
const STRIPE_TTL_S = 60 * 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = checkoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { skuIds, method, locale } = parsed.data;
  const { gateway, methods } = activeGateway();
  if (!methods.includes(method)) return NextResponse.json({ error: "method_unavailable" }, { status: 400 });

  let result;
  try {
    result = await priceSkus(skuIds);
  } catch (e) {
    if (e instanceof PricingError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const { priced, skus, missing } = result;
  if (missing) return NextResponse.json({ error: "sku_unavailable" }, { status: 400 });
  // Paymob Egypt only settles EGP.
  if (gateway === "PAYMOB" && priced.currency !== "EGP") return NextResponse.json({ error: "currency_not_supported" }, { status: 400 });

  const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const order = await db.order.create({
    data: {
      userId: user.id,
      gateway,
      method,
      currency: priced.currency,
      subtotal: priced.subtotal,
      discount: priced.discount,
      total: priced.total,
      expiresAt: new Date(Date.now() + (gateway === "STRIPE" ? STRIPE_TTL_S * 1000 : PENDING_TTL_MS)),
      items: { create: priced.lines.map((l) => ({ skuId: l.skuId, price: l.price - l.discount })) },
    },
  });

  const origin = process.env.APP_URL || new URL(req.url).origin;
  const resultUrl = `${origin}/${locale}/checkout/result?order=${order.id}`;
  const items = priced.lines.map((l) => {
    const sku = skus.get(l.skuId)!;
    const name = sku.liveSession ?? sku.lesson ?? sku.course;
    return { name: `${locale === "ar" ? name.titleAr : name.titleEn} (${sku.accessType})`, amountCents: l.price - l.discount };
  });

  try {
    let checkoutUrl: string;
    let gatewayOrderId: string;
    if (gateway === "STRIPE") {
      const cs = await stripe().checkout.sessions.create({
        mode: "payment",
        client_reference_id: order.id,
        metadata: { orderId: order.id },
        locale: locale === "ar" ? "auto" : "en",
        expires_at: Math.floor(Date.now() / 1000) + STRIPE_TTL_S,
        line_items: items.map((i) => ({
          quantity: 1,
          price_data: { currency: priced.currency.toLowerCase(), unit_amount: i.amountCents, product_data: { name: i.name } },
        })),
        success_url: resultUrl,
        cancel_url: resultUrl,
      });
      checkoutUrl = cs.url!;
      gatewayOrderId = cs.id;
    } else {
      const intention = await createIntention({
        amountCents: priced.total,
        currency: "EGP",
        method,
        specialReference: order.id,
        customer: { name: user.name, phone: user.phone ?? "", email: user.email },
        items,
        notificationUrl: `${origin}/api/webhooks/paymob`,
        redirectionUrl: resultUrl,
      });
      checkoutUrl = intention.checkoutUrl;
      gatewayOrderId = intention.intentionId;
    }
    await db.order.update({ where: { id: order.id }, data: { gatewayOrderId } });
    return NextResponse.json({ orderId: order.id, checkoutUrl });
  } catch (e) {
    await db.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
    console.error(e);
    return NextResponse.json({ error: "gateway_unavailable" }, { status: 502 });
  }
}
