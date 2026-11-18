import type { Coupon } from "@/generated/prisma/client";
import { couponState } from "./coupons";
import { db } from "./db";
import { applyPlatformDiscount, effectivePrice, type PricedCart, type Priceable } from "./pricing-engine";

/** payments.ts mints a reward coupon with this prefix and an owner when a referred friend's first order is paid. */
export const REWARD_PREFIX = "RW-";

/** The part of a SKU the reward rule reads: its course and whether a temporary price is running. */
export type RewardSku = Priceable & { courseId: string };

export type RewardOutcome =
  | { kind: "applied"; coupon: Coupon; courseId: string; priced: PricedCart }
  /** Another discount is already on the cart, so the reward waits for a cart without one. */
  | { kind: "saved"; coupon: Coupon };

/** The person's oldest reward that is still usable: not expired and never redeemed on a paid order. */
export async function findReward(userId: string, now = new Date()): Promise<Coupon | null> {
  const rewards = await db.coupon.findMany({
    where: { ownerId: userId, funding: "PLATFORM", active: true, code: { startsWith: REWARD_PREFIX } },
    orderBy: { createdAt: "asc" },
    take: 5,
  });
  for (const c of rewards) {
    const paid = await db.order.count({ where: { couponId: c.id, status: "PAID" } });
    if (couponState(c, paid, paid, now) === "ok") return c;
  }
  return null;
}

/**
 * The reward rule, kept pure: one reward, one course, never on top of another discount.
 * Another discount means a bundle, a coupon (already in `priced`) or a temporary price on any package in the cart.
 * With none of those, the reward takes its percent off the course with the largest amount to pay.
 */
export function planReward(coupon: Coupon, priced: PricedCart, skus: ReadonlyMap<string, RewardSku>, platformShareBp: number, now: Date): RewardOutcome | null {
  const otherDiscount = priced.discount > 0 || priced.platformDiscount > 0 || priced.lines.some((l) => {
    const sku = skus.get(l.skuId);
    return !!sku && effectivePrice(sku, now) < sku.price;
  });
  if (otherDiscount) return { kind: "saved", coupon };

  const byCourse = new Map<string, { skuIds: Set<string>; payable: number }>();
  for (const l of priced.lines) {
    const courseId = skus.get(l.skuId)?.courseId;
    if (!courseId) continue;
    const entry = byCourse.get(courseId) ?? { skuIds: new Set<string>(), payable: 0 };
    entry.skuIds.add(l.skuId);
    entry.payable += l.price;
    byCourse.set(courseId, entry);
  }
  let best: { courseId: string; skuIds: Set<string>; payable: number } | null = null;
  for (const [courseId, e] of byCourse) if (!best || e.payable > best.payable) best = { courseId, ...e };
  if (!best) return null;

  const discounted = applyPlatformDiscount(priced, coupon.percentOff ?? 0, platformShareBp, best.skuIds);
  return discounted === priced ? null : { kind: "applied", coupon, courseId: best.courseId, priced: discounted };
}

/** The checkout page and the checkout API both call this, so they always agree on the amount. */
export async function autoReward(userId: string, priced: PricedCart, skus: ReadonlyMap<string, RewardSku>, platformShareBp: number, now = new Date()) {
  const coupon = await findReward(userId, now);
  return coupon ? planReward(coupon, priced, skus, platformShareBp, now) : null;
}
