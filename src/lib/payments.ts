import { Prisma } from "@/generated/prisma/client";
import { accessEnd, learnerOf } from "@/lib/access";
import { logEvent } from "@/lib/analytics";
import { db } from "@/lib/db";
import { allocate, issueDocument } from "@/lib/documents";
import { DEFAULT_FINANCE, splitLine, type FinanceConfig } from "@/lib/finance";
import { notifyOrderPaid, createNotification } from "@/lib/notify";

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
        referral: { select: { id: true, status: true, referrerId: true } },
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
          // The VAT rate comes from the order, not the current settings: a mid-day edit must not
          // rewrite the tax that was actually charged.
          const cfg: FinanceConfig = setting
            ? {
                vatEnabled: order.vatRateBp > 0,
                vatRateBp: order.vatRateBp,
                vatTrn: setting.vatTrn,
                platformShareBp: setting.platformShareBp,
                referralWelcomePercentOff: setting.referralWelcomePercentOff,
                referralRewardPercentOff: setting.referralRewardPercentOff,
                corporateTaxEnabled: setting.corporateTaxEnabled,
                corporateTaxBp: setting.corporateTaxBp,
                sellerLegalName: setting.sellerLegalName,
                sellerAddress: setting.sellerAddress,
                sellerLicenceNo: setting.sellerLicenceNo,
              }
            : { ...DEFAULT_FINANCE, vatEnabled: order.vatRateBp > 0, vatRateBp: order.vatRateBp };
          const vatShares = allocate(order.vat, order.items.map((i) => i.price - i.platformDiscount));
          await trx.ledgerEntry.createMany({
            data: order.items.map((i, index) => {
              // price is pre-platform-discount; splitLine caps the funded part at the platform share.
              const split = splitLine(i.price, cfg, i.platformDiscount);
              // The order-level VAT is the authority; allocate it so the ledger sums to the cent.
              const vat = vatShares[index] ?? 0;
              return {
                kind: "SALE" as const,
                orderId: order.id,
                orderItemId: i.id,
                instructorId: i.sku.course.instructorId,
                courseId: i.sku.courseId,
                subjectId: i.sku.course.subjectId,
                gradeId: i.sku.course.gradeId,
                currency: order.currency,
                gross: split.net + vat,
                vat,
                net: split.net,
                platformFee: split.platformFee,
                instructorNet: split.instructorNet,
                corporateTax: split.corporateTax,
                corporateTaxBp: split.corporateTaxBp,
                instructorPayout: split.instructorPayout,
                platformDiscount: split.platformDiscount,
                vatRateBp: split.vatRateBp,
                platformShareBp: split.platformShareBp,
              };
            }),
            skipDuplicates: true,
          });

          // The referrer's one-time reward is minted exactly once, only after the referred family pays.
          if (order.referral?.status === "PENDING") {
            const rewardPercent = setting?.referralRewardPercentOff ?? 0;
            const { count: rewarded } = await trx.referral.updateMany({
              where: { id: order.referral.id, status: "PENDING" },
              data: { status: "REWARDED", rewardedAt: paidAt },
            });
            if (rewarded === 1 && rewardPercent > 0) {
              const coupon = await trx.coupon.create({
                data: {
                  code: `RW-${order.referral.id}`,
                  percentOff: rewardPercent,
                  funding: "PLATFORM",
                  ownerId: order.referral.referrerId,
                  perUser: 1,
                  maxRedemptions: 1,
                  active: true,
                  endsAt: new Date(paidAt.getTime() + 90 * 86_400_000),
                },
              });
              await trx.referral.update({ where: { id: order.referral.id }, data: { rewardCouponId: coupon.id } });
            }
          }
          return {
            userId: order.userId,
            amount: payable,
            currency: order.currency,
            gateway: order.gateway,
            referralId: order.referral?.id ?? null,
            referrerId: order.referral?.referrerId ?? null,
          };
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
        // An abandoned checkout must not burn the family's one welcome discount.
        await trx.referral.deleteMany({ where: { referredOrderId: order.id, status: "PENDING" } });
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
    if (paid.referrerId && paid.referralId) {
      try {
        await createNotification({
          userId: paid.referrerId,
          kind: "SYSTEM",
          titleAr: "مكافأة الإحالة جاهزة",
          titleEn: "Your referral reward is ready",
          bodyAr: "أصبح لديك كود خصم لاشتراكك القادم. تجده في حسابك.",
          bodyEn: "You have a discount code for your next subscription. It is in your account.",
          href: "/account",
          dedupeKey: `referral-reward:${paid.referralId}`,
        });
      } catch (e) {
        console.error("[notify] referral reward failed", paid.referralId, e);
      }
    }
    await logEvent({ name: "order_paid", userId: paid.userId, props: { ...paid } });
    // A document-delivery failure must never undo a settled payment. The page backfills on first view.
    try {
      await issueDocument(orderId, "INVOICE");
    } catch (e) {
      console.error("[documents] invoice issue failed", orderId, e);
    }
  }
  if (replay) return false;
  return true;
}