import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { logEvent } from "@/lib/analytics";
import { priceSkus } from "@/lib/checkout";
import { resolveCoupon } from "@/lib/coupon-resolve";
import { db } from "@/lib/db";
import { vatOn } from "@/lib/finance";
import { activeGateway, stripeTestKeyInProduction, stripeUnitAmount, type Method } from "@/lib/gateway";
import { createIntention } from "@/lib/paymob";
import { getFinanceConfig } from "@/lib/platform-settings";
import { applyPaymentOutcome } from "@/lib/payments";
import { applyCoupon, PricingError } from "@/lib/pricing-engine";
import { TERMS_VERSION } from "@/lib/legal";
import { isLimited } from "@/lib/rate-limit";
import { checkoutSchema } from "@/lib/schemas/checkout";
import { stripe } from "@/lib/stripe";
import { createIntent, ziinaCapReached } from "@/lib/ziina";

// Kiosk orders wait for cash; after this window the reference is treated as expired.
const PENDING_TTL_MS = 72 * 60 * 60 * 1000;
// Stripe allows a Checkout Session to live 30 minutes to 24 hours.
const STRIPE_TTL_S = 60 * 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  // Every request creates an order and a live gateway intent, and scans the month's paid orders.
  if (await isLimited(`checkout:${session.user.id}`, 10, 3_600_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const parsed = checkoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { skuIds, method, locale, coupon, forStudentId } = parsed.data;

  // A parent learns nothing themselves: they buy for a child they have linked, and only for one.
  let beneficiaryId: string | null = null;
  if (session.user.role === "PARENT") {
    if (!forStudentId) return NextResponse.json({ error: "child_required" }, { status: 400 });
    const link = await db.parentLink.findUnique({
      where: { parentId_studentId: { parentId: session.user.id, studentId: forStudentId } },
      select: { id: true },
    });
    if (!link) return NextResponse.json({ error: "child_required" }, { status: 400 });
    beneficiaryId = forStudentId;
  } else if (forStudentId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let result;
  try {
    result = await priceSkus(skuIds);
  } catch (e) {
    if (e instanceof PricingError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const { skus, missing } = result;
  if (missing) return NextResponse.json({ error: "sku_unavailable" }, { status: 400 });

  // The coupon is resolved again here, never trusted from the browser.
  let priced = result.priced;
  let couponId: string | null = null;
  if (coupon) {
    const resolved = await resolveCoupon(coupon, session.user.id);
    if (!resolved.ok) return NextResponse.json({ error: `coupon_${resolved.reason}` }, { status: 400 });
    try {
      priced = applyCoupon(priced, resolved.coupon);
    } catch (e) {
      if (e instanceof PricingError) return NextResponse.json({ error: "coupon_currency" }, { status: 400 });
      throw e;
    }
    couponId = resolved.coupon.id;
  }

  // VAT is added on top of the net total. It is zero unless the owner has switched it on.
  const cfg = await getFinanceConfig();
  const vat = vatOn(priced.total, cfg);
  const payable = priced.total + vat;

  // A 100% code leaves nothing for a gateway to charge; such an order is completed below without one.
  const free = payable === 0;
  const active = free ? { gateway: "MANUAL" as const, methods: [] as Method[] } : activeGateway(priced.currency);
  if (!active) return NextResponse.json({ error: "payments_unavailable" }, { status: 400 });
  const { gateway, methods } = active;
  if (!free && !methods.includes(method)) return NextResponse.json({ error: "method_unavailable" }, { status: 400 });
  // Ziina's Professional tier caps monthly receipts; refuse rather than fall back to test Stripe.
  if (gateway === "ZIINA" && (await ziinaCapReached(payable))) {
    return NextResponse.json({ error: "cap_reached" }, { status: 409 });
  }

  const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const net = (l: (typeof priced.lines)[number]) => l.price - l.discount - l.couponDiscount;
  const order = await db.order.create({
    data: {
      userId: user.id,
      beneficiaryId,
      // The buyer accepted the terms by pressing Pay; record which text was in force.
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: new Date(),
      gateway,
      method: free ? null : method,
      currency: priced.currency,
      subtotal: priced.subtotal,
      discount: priced.discount,
      total: priced.total,
      vat,
      vatRateBp: vat > 0 ? cfg.vatRateBp : 0,
      couponId,
      expiresAt: free ? null : new Date(Date.now() + (gateway === "STRIPE" ? STRIPE_TTL_S * 1000 : PENDING_TTL_MS)),
      items: { create: priced.lines.map((l) => ({ skuId: l.skuId, price: net(l) })) },
    },
  });

  await logEvent({
    name: "checkout_started",
    userId: user.id,
    courseId: skus.get(priced.lines[0]?.skuId ?? "")?.courseId ?? null,
    props: { gateway, currency: priced.currency, lines: priced.lines.length, amount: payable },
  });

  const origin = process.env.APP_URL || new URL(req.url).origin;
  const resultUrl = `${origin}/${locale}/checkout/result?order=${order.id}`;

  if (free) {
    // Record the zero payment through the same path as a webhook, so entitlements are granted exactly once.
    await applyPaymentOutcome(order.id, `free:${order.id}`, { kind: "paid", amount: 0, currency: priced.currency }, { free: true, couponId });
    return NextResponse.json({ orderId: order.id, checkoutUrl: resultUrl });
  }

  // Zero-value lines are dropped: Stripe rejects a zero unit amount, and the sum is still the order total.
  const items = priced.lines
    .map((l) => {
      const sku = skus.get(l.skuId)!;
      const name = sku.liveSession ?? sku.lesson ?? sku.course;
      return { name: `${locale === "ar" ? name.titleAr : name.titleEn} (${sku.accessType})`, amountCents: net(l) };
    })
    .filter((i) => i.amountCents > 0);
  if (vat > 0) items.push({ name: `VAT (${cfg.vatRateBp / 100}%)`, amountCents: vat });

  let checkoutUrl: string;
  let gatewayOrderId: string;
  try {
    if (gateway === "STRIPE") {
      // A test key in production would take fake payments. Refuse rather than pretend.
      if (stripeTestKeyInProduction()) throw new Error("stripe_test_key_in_production");
      const cs = await stripe().checkout.sessions.create({
        mode: "payment",
        client_reference_id: order.id,
        metadata: { orderId: order.id },
        locale: locale === "ar" ? "auto" : "en",
        expires_at: Math.floor(Date.now() / 1000) + STRIPE_TTL_S,
        line_items: items.map((i) => ({
          quantity: 1,
          price_data: { currency: priced.currency.toLowerCase(), unit_amount: stripeUnitAmount(i.amountCents, priced.currency), product_data: { name: i.name } },
        })),
        success_url: resultUrl,
        cancel_url: resultUrl,
      });
      checkoutUrl = cs.url!;
      gatewayOrderId = cs.id;
    } else if (gateway === "ZIINA") {
      const intent = await createIntent({
        amount: payable,
        // Human fallback for support; never parsed as authority.
        message: `Order ${order.id}`,
        successUrl: resultUrl,
        cancelUrl: resultUrl,
      });
      checkoutUrl = intent.redirectUrl;
      gatewayOrderId = intent.id;
    } else {
      const intention = await createIntention({
        amountCents: payable,
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
  } catch (e) {
    await db.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
    console.error(e);
    return NextResponse.json({ error: "gateway_unavailable" }, { status: 502 });
  }

  // Kept apart from creation: a provider that does not echo our order id (Ziina) would leave a
  // real payment orphaned if this write failed and we marked the order FAILED.
  try {
    await db.order.update({ where: { id: order.id }, data: { gatewayOrderId } });
  } catch {
    try {
      await db.order.update({ where: { id: order.id }, data: { gatewayOrderId } });
    } catch {
      console.error("[checkout] gatewayOrderId write failed", { orderId: order.id, gatewayOrderId });
    }
  }
  return NextResponse.json({ orderId: order.id, checkoutUrl });
}
