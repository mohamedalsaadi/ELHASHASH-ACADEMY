import Stripe from "stripe";
import { applyPaymentOutcome } from "@/lib/payments";

let client: Stripe | null = null;
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing env STRIPE_SECRET_KEY");
  return (client ??= new Stripe(key));
}

/** Maps a Checkout Session's state onto our order. orderId travels as client_reference_id. */
export async function syncCheckoutSession(session: Stripe.Checkout.Session, eventId: string): Promise<void> {
  const orderId = session.client_reference_id;
  if (!orderId) return;
  if (session.status === "complete" && session.payment_status === "paid") {
    await applyPaymentOutcome(orderId, eventId, { kind: "paid", amount: session.amount_total ?? -1, currency: session.currency ?? "" }, session);
  } else if (session.status === "expired") {
    await applyPaymentOutcome(orderId, eventId, { kind: "expired" }, session);
  }
}
