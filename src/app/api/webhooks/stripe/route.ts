import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { applyPaymentOutcome } from "@/lib/payments";
import { stripe, syncCheckoutSession } from "@/lib/stripe";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  let event: Stripe.Event;
  try {
    // The signature covers the raw body, so read text, not JSON.
    event = stripe().webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.expired":
      await syncCheckoutSession(event.data.object, `stripe:${event.id}`);
      break;
    case "checkout.session.async_payment_failed": {
      const orderId = event.data.object.client_reference_id;
      if (orderId) await applyPaymentOutcome(orderId, `stripe:${event.id}`, { kind: "failed" }, event.data.object);
      break;
    }
  }
  return NextResponse.json({ received: true });
}
