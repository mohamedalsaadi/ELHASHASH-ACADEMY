import { createHmac, timingSafeEqual } from "node:crypto";

const BASE = "https://accept.paymob.com";

export type PaymobMethod = "CARD" | "WALLET" | "KIOSK" | "VALU";

const integrationEnv: Record<PaymobMethod, string> = {
  CARD: "PAYMOB_INTEGRATION_CARD",
  WALLET: "PAYMOB_INTEGRATION_WALLET",
  KIOSK: "PAYMOB_INTEGRATION_KIOSK",
  VALU: "PAYMOB_INTEGRATION_VALU",
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

/**
 * Creates a Paymob payment intention and returns the hosted Unified Checkout URL.
 * specialReference is our Order.id; Paymob echoes it back as order.merchant_order_id in the webhook.
 */
export async function createIntention(input: {
  amountCents: number;
  currency: "EGP";
  method: PaymobMethod;
  specialReference: string;
  customer: { name: string; phone: string; email?: string | null };
  items: { name: string; amountCents: number }[];
  notificationUrl: string;
  redirectionUrl: string;
}): Promise<{ checkoutUrl: string; intentionId: string }> {
  const [first, ...rest] = input.customer.name.trim().split(/\s+/);
  const res = await fetch(`${BASE}/v1/intention/`, {
    method: "POST",
    headers: { Authorization: `Token ${requireEnv("PAYMOB_SECRET_KEY")}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      amount: input.amountCents,
      currency: input.currency,
      payment_methods: [Number(requireEnv(integrationEnv[input.method]))],
      items: input.items.map((i) => ({ name: i.name.slice(0, 50), amount: i.amountCents, quantity: 1 })),
      billing_data: {
        first_name: first || "Student",
        last_name: rest.join(" ") || "-",
        phone_number: input.customer.phone,
        email: input.customer.email || process.env.SUPPORT_EMAIL || process.env.MAIL_FROM?.match(/[^<\s]+@[^>\s]+/)?.[0] || "no-reply@example.com",
      },
      special_reference: input.specialReference,
      notification_url: input.notificationUrl,
      redirection_url: input.redirectionUrl,
    }),
  });
  if (!res.ok) throw new Error(`Paymob intention failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id: string; client_secret: string };
  const publicKey = requireEnv("PAYMOB_PUBLIC_KEY");
  return {
    intentionId: data.id,
    checkoutUrl: `${BASE}/unifiedcheckout/?publicKey=${encodeURIComponent(publicKey)}&clientSecret=${encodeURIComponent(data.client_secret)}`,
  };
}

/** The transaction object Paymob posts as `obj` in a TRANSACTION callback (fields we read). */
export type PaymobTransaction = {
  id: number;
  amount_cents: number;
  created_at: string;
  currency: string;
  error_occured: boolean;
  has_parent_transaction: boolean;
  integration_id: number;
  is_3d_secure: boolean;
  is_auth: boolean;
  is_capture: boolean;
  is_refunded: boolean;
  is_standalone_payment: boolean;
  is_voided: boolean;
  order: { id: number; merchant_order_id?: string | null };
  owner: number;
  pending: boolean;
  source_data: { pan?: string | number | null; sub_type?: string | null; type?: string | null };
  success: boolean;
  data?: { bill_reference?: string | number | null };
};

// Paymob's documented field order for the transaction-callback HMAC.
export function hmacString(t: PaymobTransaction): string {
  return [
    t.amount_cents,
    t.created_at,
    t.currency,
    t.error_occured,
    t.has_parent_transaction,
    t.id,
    t.integration_id,
    t.is_3d_secure,
    t.is_auth,
    t.is_capture,
    t.is_refunded,
    t.is_standalone_payment,
    t.is_voided,
    t.order.id,
    t.owner,
    t.pending,
    t.source_data.pan ?? "",
    t.source_data.sub_type ?? "",
    t.source_data.type ?? "",
    t.success,
  ].join("");
}

export function signTransaction(t: PaymobTransaction, secret: string): string {
  return createHmac("sha512", secret).update(hmacString(t)).digest("hex");
}

export function verifyTransactionHmac(t: PaymobTransaction, received: string, secret: string): boolean {
  const expected = Buffer.from(signTransaction(t, secret), "hex");
  const got = Buffer.from(received, "hex");
  return got.length === expected.length && timingSafeEqual(got, expected);
}
