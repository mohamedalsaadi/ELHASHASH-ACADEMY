// Ziina (UAE) hosted checkout. The payer is sent to Ziina's page; we never see card data.
// Amounts are in the same minor units the app stores.

import { db } from "@/lib/db";
import { ziinaTestMode } from "@/lib/gateway";
import { applyPaymentOutcome } from "@/lib/payments";
import { refundIdFor } from "@/lib/ziina-format";

const BASE = "https://api-v2.ziina.com/api";

function authKey(): string {
  const key = process.env.ZIINA_API_KEY;
  if (!key) throw new Error("ZIINA_API_KEY is not set");
  return key;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${authKey()}`, "content-type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`ziina ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

export type Intent = {
  id: string;
  status: string;
  amount: number;
  currency_code: string;
  redirect_url?: string;
};

export async function createIntent(input: {
  amount: number;
  message?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; redirectUrl: string }> {
  // A test intent completes without money; never let one be created on production.
  if (process.env.ZIINA_TEST === "1" && !ziinaTestMode()) throw new Error("ziina_test_in_production");

  const intent = await call<Intent>("/payment_intent", {
    method: "POST",
    body: JSON.stringify({
      amount: input.amount,
      currency_code: "AED",
      message: input.message?.slice(0, 100),
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      failure_url: input.successUrl,
      test: ziinaTestMode() || undefined,
    }),
  });
  if (!intent.id || !intent.redirect_url) throw new Error("ziina_intent_incomplete");
  return { id: intent.id, redirectUrl: intent.redirect_url };
}

export function fetchIntent(id: string): Promise<Intent> {
  return call<Intent>(`/payment_intent/${encodeURIComponent(id)}`);
}

/**
 * Fetches the intent from Ziina and settles the order from that answer, never from a webhook
 * body. Safe to call from both the result page and the webhook: the event id makes it a no-op
 * the second time. Returns null when the order has no intent yet.
 */
export async function syncPaymentIntent(order: {
  id: string;
  gatewayOrderId: string | null;
  total: number;
  vat: number;
  currency: string;
}) {
  if (!order.gatewayOrderId) return null;
  const intent = await fetchIntent(order.gatewayOrderId);
  const eventId = `ziina:${intent.id}:${intent.status}`;

  if (intent.status === "completed") {
    const payable = order.total + order.vat;
    if (intent.amount !== payable || intent.currency_code.toUpperCase() !== order.currency) {
      // Never settle a mismatched amount; the owner can still mark it paid by hand.
      console.error("[ziina] amount mismatch", {
        order: order.id,
        intent: intent.id,
        intentAmount: intent.amount,
        payable,
        currency: intent.currency_code,
      });
      return { intent, mismatch: true as const };
    }
    await applyPaymentOutcome(order.id, eventId, { kind: "paid", amount: intent.amount, currency: order.currency }, intent);
  } else if (intent.status === "failed") {
    await applyPaymentOutcome(order.id, eventId, { kind: "failed" }, intent);
  } else if (intent.status === "canceled") {
    await applyPaymentOutcome(order.id, eventId, { kind: "expired" }, intent);
  }
  return { intent, mismatch: false as const };
}

export async function refundIntent(input: { orderId: string; paymentIntentId: string; amount: number }) {
  return call<{ id: string; status: string }>("/refund", {
    method: "POST",
    body: JSON.stringify({
      id: refundIdFor(input.orderId),
      payment_intent_id: input.paymentIntentId,
      amount: input.amount,
      currency_code: "AED",
      test: ziinaTestMode() || undefined,
    }),
  });
}

// ponytail: a soft, race-prone cap check for the Professional tier, not enforcement.
export async function ziinaCapReached(payable: number, now = new Date()): Promise<boolean> {
  const capMinor = Number(process.env.ZIINA_MONTHLY_CAP_AED ?? 50000) * 100;
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const rows = await db.order.findMany({
    where: { gateway: "ZIINA", status: "PAID", paidAt: { gte: monthStart } },
    select: { total: true, vat: true },
  });
  const mtd = rows.reduce((sum, o) => sum + o.total + o.vat, 0);
  return mtd + payable > capMinor;
}
