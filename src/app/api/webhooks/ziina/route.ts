import { NextResponse } from "next/server";
import { clientIp } from "@/lib/client-ip";
import { db } from "@/lib/db";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { syncPaymentIntent } from "@/lib/ziina";
import { intentCandidates } from "@/lib/ziina-format";

/**
 * Ziina's webhook body and signature are undocumented, so this handler is a trigger only: it
 * harvests plausible intent ids, finds our own pending order, and asks Ziina what actually
 * happened. A forged call can cause at most one lookup and one outbound GET; it can never mark
 * an order paid, because settlement needs a genuinely completed intent bound to that order.
 */
export async function POST(req: Request) {
  if (!process.env.ZIINA_API_KEY) return NextResponse.json({ error: "not_configured" }, { status: 500 });
  // No signature is available from Ziina, so cap the work an anonymous caller can cause:
  // each accepted call costs one lookup and one outbound request.
  const ip = clientIp(req.headers);
  if (await isLimited(`ziina-hook:${ip}`, 60, 3_600_000)) return NextResponse.json({ ok: true, ignored: "rate_limited" });

  const text = await req.text();
  if (text.length > 50_000) return NextResponse.json({ ok: true, ignored: "too_large" });

  try {
    for (const id of intentCandidates(text)) {
      const order = await db.order.findFirst({
        where: { gatewayOrderId: id, gateway: "ZIINA", status: "PENDING" },
        select: { id: true, gatewayOrderId: true, total: true, vat: true, currency: true },
      });
      if (!order) continue;
      const result = await syncPaymentIntent(order);
      return NextResponse.json({
        ok: true,
        status: result?.intent.status ?? null,
        mismatch: result?.mismatch ?? false,
      });
    }
    // Only calls that match no pending order count: real Ziina callbacks share a few IPs and are never retried once ignored.
    await recordAttempt(`ziina-hook:${ip}`);
    return NextResponse.json({ ok: true, ignored: true });
  } catch (e) {
    // Transient failure: 500 so Ziina retries. The result page remains the primary path anyway.
    console.error("[ziina] webhook failed", e);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
