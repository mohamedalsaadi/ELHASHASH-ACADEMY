import { Prisma } from "@/generated/prisma/client";
import { accessEnd } from "@/lib/access";
import { db } from "@/lib/db";
import { notifyOrderPaid } from "@/lib/notify";

export type PaymentOutcome =
  | { kind: "paid"; amount: number; currency: string }
  | { kind: "pending"; kioskRef?: string }
  | { kind: "failed" }
  | { kind: "expired" };

/**
 * Applies one gateway event to an order. Safe to call any number of times, from webhooks
 * or from the result page: the unique eventId drops replays, and the PAID transition is a
 * conditional update, so access is granted exactly once even when two callers race.
 * Returns false when the event was already recorded.
 */
export async function applyPaymentOutcome(orderId: string, eventId: string, outcome: PaymentOutcome, payload: unknown): Promise<boolean> {
  let granted = false;
  try {
    await db.$transaction(async (trx) => {
      await trx.paymentEvent.create({ data: { orderId, gatewayEventId: eventId, payload: payload as Prisma.InputJsonValue } });
      const order = await trx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: { include: { sku: true } } } });

      switch (outcome.kind) {
        case "paid": {
          if (outcome.amount !== order.total || outcome.currency.toUpperCase() !== order.currency) {
            throw new Error(`Amount mismatch on order ${order.id}: got ${outcome.amount} ${outcome.currency}`);
          }
          const paidAt = new Date();
          const { count } = await trx.order.updateMany({
            where: { id: order.id, status: { not: "PAID" } },
            data: { status: "PAID", paidAt },
          });
          if (count === 1) {
            await trx.entitlement.createMany({
              data: order.items.map((i) => ({
                userId: order.userId,
                courseId: i.sku.courseId,
                lessonId: i.sku.lessonId,
                liveSessionId: i.sku.liveSessionId,
                accessType: i.sku.accessType,
                term: i.sku.term,
                month: i.sku.month,
                orderId: order.id,
                endsAt: accessEnd(i.sku, paidAt),
              })),
            });
            granted = true;
          }
          break;
        }
        case "pending":
          if (outcome.kioskRef) await trx.order.update({ where: { id: order.id }, data: { kioskRef: outcome.kioskRef } });
          break;
        case "failed":
        case "expired":
          await trx.order.updateMany({
            where: { id: order.id, status: "PENDING" },
            data: { status: outcome.kind === "failed" ? "FAILED" : "EXPIRED" },
          });
          break;
      }
    });
    // The receipt is sent after the commit; a mail failure must not undo the payment.
    if (granted) {
      try {
        await notifyOrderPaid(orderId);
      } catch (e) {
        console.error("[notify] order paid failed", orderId, e);
      }
    }
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}
