import { Prisma } from "@/generated/prisma/client";
import { accessEnd, learnerOf } from "@/lib/access";
import { logEvent } from "@/lib/analytics";
import { db } from "@/lib/db";
import { DEFAULT_FINANCE, splitLine, type FinanceConfig } from "@/lib/finance";
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
  let replay = false;
  // Null unless this call is the one that flipped the order to PAID.
  const paid = await db.$transaction(async (trx) => {
    // The event id is the only unique key in this transaction, so a P2002 from this insert is a replay.
    try {
      await trx.paymentEvent.create({ data: { orderId, gatewayEventId: eventId, payload: payload as Prisma.InputJsonValue } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        replay = true;
        return null;
      }
      throw e;
    }
    const order = await trx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        items: {
          include: {
            sku: { include: { course: { select: { instructorId: true, subjectId: true, gradeId: true } } } },
          },
        },
      },
    });

    switch (outcome.kind) {
      case "paid": {
        // VAT is charged on top of the net total, so the gateway amount is both.
        const payable = order.total + order.vat;
        if (outcome.amount !== payable || outcome.currency.toUpperCase() !== order.currency) {
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
              userId: learnerOf(order),
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

          // One immutable money row per line. Rates are read once and copied onto the row.
          const setting = await trx.platformSetting.findUnique({ where: { id: "singleton" } });
          const cfg: FinanceConfig = setting
            ? {
                vatEnabled: setting.vatEnabled,
                vatRateBp: setting.vatRateBp,
                vatTrn: setting.vatTrn,
                platformShareBp: setting.platformShareBp,
              }
            : { ...DEFAULT_FINANCE };
          await trx.ledgerEntry.createMany({
            data: order.items.map((i) => {
              const split = splitLine(i.price, cfg);
              return {
                kind: "SALE" as const,
                orderId: order.id,
                orderItemId: i.id,
                instructorId: i.sku.course.instructorId,
                courseId: i.sku.courseId,
                subjectId: i.sku.course.subjectId,
                gradeId: i.sku.course.gradeId,
                currency: order.currency,
                gross: split.gross,
                vat: split.vat,
                net: split.net,
                platformFee: split.platformFee,
                instructorNet: split.instructorNet,
                vatRateBp: split.vatRateBp,
                platformShareBp: split.platformShareBp,
              };
            }),
            skipDuplicates: true,
          });
          return { userId: order.userId, amount: payable, currency: order.currency, gateway: order.gateway };
        }
        return null;
      }
      case "pending":
        if (outcome.kioskRef) await trx.order.update({ where: { id: order.id }, data: { kioskRef: outcome.kioskRef } });
        return null;
      case "failed":
      case "expired":
        await trx.order.updateMany({
          where: { id: order.id, status: "PENDING" },
          data: { status: outcome.kind === "failed" ? "FAILED" : "EXPIRED" },
        });
        return null;
    }
    return null;
  });
  // The receipt is sent after the commit; a mail failure must not undo the payment.
  if (paid) {
    try {
      await notifyOrderPaid(orderId);
    } catch (e) {
      console.error("[notify] order paid failed", orderId, e);
    }
    await logEvent({ name: "order_paid", userId: paid.userId, props: { ...paid } });
  }
  if (replay) return false;
  return true;
}