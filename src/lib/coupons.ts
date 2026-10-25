export type CouponRule = {
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  maxRedemptions: number | null;
  perUser: number;
};

export type CouponProblem = "invalid" | "not_started" | "expired" | "used_up" | "used_by_you";

export const normalizeCode = (code: string) => code.trim().toUpperCase();
export const CODE_RE = /^[A-Z0-9_-]{3,32}$/;

/** Pure eligibility check; paid counts come from the caller so the rule is testable without a database. */
export function couponState(c: CouponRule, paidTotal: number, paidByUser: number, now: Date): CouponProblem | "ok" {
  if (!c.active) return "invalid";
  if (c.startsAt && now < c.startsAt) return "not_started";
  if (c.endsAt && now >= c.endsAt) return "expired";
  if (c.maxRedemptions != null && paidTotal >= c.maxRedemptions) return "used_up";
  if (paidByUser >= c.perUser) return "used_by_you";
  return "ok";
}

