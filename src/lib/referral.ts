import { randomBytes } from "node:crypto";
import type { Coupon, CouponFunding, ReferralCode } from "@/generated/prisma/client";
import { CODE_RE, normalizeCode, type CouponProblem } from "./coupons";
import { db } from "./db";
import { resolveCoupon } from "./coupon-resolve";

export type DiscountProblem = CouponProblem | "referral_self" | "referral_used" | "referral_not_first" | "referral_unavailable";

/** A referral code gives the friend no discount: it only records who sent them, so the sender is rewarded when they pay. */
export type ReferralResolution = { ok: true; kind: "referral"; code: ReferralCode; referrerId: string } | { ok: false; reason: DiscountProblem };

export type DiscountResolution =
  | { ok: true; kind: "coupon"; coupon: Coupon; funding: CouponFunding }
  | Extract<ReferralResolution, { ok: true }>
  | { ok: false; reason: DiscountProblem };

/** Set by the invitation link (`/{locale}/r/{code}`) so a friend needs no code field. */
export const REFERRAL_COOKIE = "dh_ref";
export const REFERRAL_COOKIE_DAYS = 30;

/** "DHR" plus 8 hex characters: unguessable enough for a public code, and valid for the coupon code rule. */
export function newReferralCode(): string {
  return `DHR${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** One stable code per person, created on first visit to the referral card. */
export async function getOrCreateReferralCode(userId: string) {
  const existing = await db.referralCode.findUnique({ where: { userId } });
  if (existing) return existing;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.referralCode.create({ data: { userId, code: newReferralCode() } });
    } catch (e) {
      // A code collision is astronomically unlikely; a concurrent first visit is not. Retry the read.
      if (attempt === 2) throw e;
      const raced = await db.referralCode.findUnique({ where: { userId } });
      if (raced) return raced;
    }
  }
  throw new Error("unreachable");
}

/** The buyer, the student they are paying for, and every ParentLink in either direction. */
export async function familyOf(userId: string, beneficiaryId?: string | null): Promise<string[]> {
  const [asParent, asChild] = await Promise.all([
    db.parentLink.findMany({ where: { parentId: userId }, select: { studentId: true } }),
    db.parentLink.findMany({ where: { studentId: userId }, select: { parentId: true } }),
  ]);
  return [...new Set([userId, ...(beneficiaryId ? [beneficiaryId] : []), ...asParent.map((l) => l.studentId), ...asChild.map((l) => l.parentId)])];
}

/**
 * Whether this code may be credited with a friend: it exists, the program is on (the reward is above zero), the
 * friend is not the sender's own family, and it is the friend's first paid order and first referral.
 */
export async function resolveReferral(codeInput: string, userId: string, beneficiaryId: string | null = null): Promise<ReferralResolution> {
  const code = normalizeCode(codeInput);
  if (!CODE_RE.test(code)) return { ok: false, reason: "invalid" };

  const referral = await db.referralCode.findUnique({ where: { code } });
  if (!referral || !referral.active) return { ok: false, reason: "invalid" };

  const setting = await db.platformSetting.findUnique({ where: { id: "singleton" }, select: { referralRewardPercentOff: true } });
  if ((setting?.referralRewardPercentOff ?? 0) <= 0) return { ok: false, reason: "referral_unavailable" };

  const family = await familyOf(userId, beneficiaryId);
  if (family.includes(referral.userId)) return { ok: false, reason: "referral_self" };

  const [used, paid] = await Promise.all([
    db.referral.findFirst({
      where: { referredUserId: { in: family }, OR: [{ status: "REWARDED" }, { order: { status: "PAID" } }] },
      select: { id: true },
    }),
    db.order.findFirst({
      where: { status: "PAID", OR: [{ userId: { in: family } }, { beneficiaryId: { in: family } }] },
      select: { id: true },
    }),
  ]);
  if (used) return { ok: false, reason: "referral_used" };
  if (paid) return { ok: false, reason: "referral_not_first" };

  return { ok: true, kind: "referral", code: referral, referrerId: referral.userId };
}

/**
 * One code field, two kinds of code. An ordinary coupon keeps its existing behaviour. A referral code gives the
 * friend nothing off; it credits the sender (see `resolveReferral`). A reward coupon is never typed: it applies by itself.
 */
export async function resolveDiscount(
  codeInput: string,
  userId: string,
  beneficiaryId: string | null = null,
  now = new Date(),
): Promise<DiscountResolution> {
  const code = normalizeCode(codeInput);
  if (!CODE_RE.test(code)) return { ok: false, reason: "invalid" };

  const coupon = await resolveCoupon(code, userId, now);
  if (coupon.ok) {
    // Only the reward coupon has an owner. It applies to one course, and only on a cart with no other discount.
    if (coupon.coupon.ownerId) return { ok: false, reason: "invalid" };
    return { ok: true, kind: "coupon", coupon: coupon.coupon, funding: coupon.coupon.funding };
  }
  // A code that matched a coupon but failed its window or limit must not fall through to a referral.
  if (coupon.reason !== "invalid") return { ok: false, reason: coupon.reason };

  return resolveReferral(code, userId, beneficiaryId);
}
