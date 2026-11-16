import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyTransactionHmac, type PaymobTransaction } from "@/lib/paymob";
import { applyPaymentOutcome } from "@/lib/payments";
import { logWarn } from "@/lib/log-error";

// Paymob posts { type: "TRANSACTION", obj } with ?hmac=... A kiosk payment sends a pending callback
// first, then a success callback for the same transaction id once cash is paid.
export async function POST(req: Request) {
  const secret = process.env.PAYMOB_HMAC_SECRET;
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const hmac = new URL(req.url).searchParams.get("hmac") ?? "";
  const body = (await req.json().catch(() => null)) as { type?: string; obj?: PaymobTransaction } | null;
  const tx = body?.obj;
  if (body?.type !== "TRANSACTION" || !tx) return NextResponse.json({ ok: true, ignored: true });
  if (!verifyTransactionHmac(tx, hmac, secret)) {
    await logWarn("payment.webhook", "Paymob webhook with a bad signature", { sample: 600_000 });
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  const orderId = tx.order.merchant_order_id;
  const order = orderId ? await db.order.findUnique({ where: { id: orderId } }) : null;
  if (!order) {
    await logWarn("payment.webhook", "Paymob webhook for an unknown order", { meta: { orderId: orderId ?? null }, sample: 600_000 });
    return NextResponse.json({ ok: true, ignored: "unknown_order" });
  }

  const ref = tx.data?.bill_reference;
  const applied = await applyPaymentOutcome(
    order.id,
    `paymob:${tx.id}:${tx.success}:${tx.pending}`,
    tx.success && !tx.pending
      ? { kind: "paid", amount: tx.amount_cents, currency: tx.currency }
      : tx.pending
        ? { kind: "pending", kioskRef: ref ? String(ref) : undefined }
        : { kind: "failed" },
    tx,
  );
  return NextResponse.json({ ok: true, duplicate: !applied });
}
