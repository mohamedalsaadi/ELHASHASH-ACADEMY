import { couponState, normalizeCode, CODE_RE } from "./coupons";
import { db } from "./db";

// ponytail: limits count PAID orders, so two simultaneous pending checkouts can pass the cap. Add a
// redemption row if a code is ever abused beyond that.
export async function resolveCoupon(codeInput: string, userId: string, now = new Date()) {
  const code = normalizeCode(codeInput);
  if (!CODE_RE.test(code)) return { ok: false as const, reason: "invalid" as const };
  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon) return { ok: false as const, reason: "invalid" as const };

  const [paidTotal, paidByUser] = await Promise.all([
    db.order.count({ where: { couponId: coupon.id, status: "PAID" } }),
    db.order.count({ where: { couponId: coupon.id, userId, status: "PAID" } }),
  ]);
  const state = couponState(coupon, paidTotal, paidByUser, now);
  return state === "ok" ? { ok: true as const, coupon } : { ok: false as const, reason: state };
}
