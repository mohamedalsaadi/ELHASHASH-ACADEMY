import { minorPerUnit } from "./format";

export type AccessType = "SEMESTER" | "YEARLY" | "REVISION" | "FIXED_DAYS" | "RENTAL" | "LIVE" | "MONTHLY";
export type Currency = "EGP" | "SAR" | "AED" | "KWD" | "QAR" | "BHD" | "OMR";

export type CartLine = {
  skuId: string;
  courseId: string;
  /** null for skill courses, which join no bundle. */
  subjectId: string | null;
  accessType: AccessType;
  price: number;
  currency: Currency;
  saleFrom?: Date | null;
  saleTo?: Date | null;
};

/** `minSubjects` lets one rule express a tier ("any 2 of these subjects"); null means every subject in the rule. */
export type BundleRule = { id: string; subjectIds: string[]; percentOff: number; minSubjects?: number | null };

export type PricedCart = {
  currency: Currency;
  subtotal: number;
  /// Bundles plus coupon.
  discount: number;
  /// The coupon's part of `discount`.
  couponDiscount: number;
  /// Platform-funded discount, on top of `discount`.
  platformDiscount: number;
  total: number;
  lines: { skuId: string; price: number; discount: number; couponDiscount: number; platformDiscount: number }[];
  applied: { ruleId: string; skuIds: string[]; amount: number }[];
};

/** A SKU's normal price with its optional temporary price. Kept structural so pages can pass Prisma rows. */
export type Priceable = {
  price: number;
  discountPrice?: number | null;
  discountFrom?: Date | null;
  discountTo?: Date | null;
};

export type CouponLike = { percentOff: number | null; amountOff: number | null; currency: Currency | null };

export class PricingError extends Error {}

type Application = { ruleId: string; lines: number[]; amount: number };
type Plan = { amount: number; applications: Application[] };

/** One lecture or one live seat: bundles are for whole-course subscriptions only. */
const SINGLES = new Set<AccessType>(["RENTAL", "LIVE"]);

// Discounts round to 0.01 of the unit, so 3-decimal currencies stay on a multiple of 10 fils (Stripe requires it).
const lineDiscount = (amount: number, percentOff: number, currency: Currency) => {
  const step = minorPerUnit(currency) / 100;
  return Math.round((amount * percentOff) / 100 / step) * step;
};

/**
 * Prices a cart in integer minor units (piastres / fils).
 * Bundles: each rule discounts one line per matching subject; a line joins at most one bundle, rentals and live seats join none,
 * a rule may apply more than once, and the combination with the largest total saving wins. A rule needs at least
 * `minSubjects` distinct subjects (default: all of them) to apply, and then discounts every one it matched.
 */
export function price(cart: CartLine[], rules: BundleRule[], now: Date): PricedCart {
  if (cart.length === 0) throw new PricingError("empty_cart");
  const currency = cart[0].currency;
  if (cart.some((l) => l.currency !== currency)) throw new PricingError("mixed_currency");
  if (new Set(cart.map((l) => l.skuId)).size !== cart.length) throw new PricingError("duplicate_sku");
  for (const l of cart) {
    if ((l.saleFrom && now < l.saleFrom) || (l.saleTo && now >= l.saleTo)) throw new PricingError("sku_not_on_sale");
  }

  // Pricier lines first, so a rule takes the most valuable line for each of its subjects.
  const order = cart.map((_, i) => i).sort((a, b) => cart[b].price - cart[a].price);

  const tryApply = (rule: BundleRule, used: Set<number>): Application | null => {
    const need = rule.minSubjects ?? rule.subjectIds.length;
    if (need <= 0) return null;
    const picked: number[] = [];
    // One line per subject; a tier takes every subject it can and needs at least `need` of them.
    for (const subjectId of rule.subjectIds) {
      const i = order.find((j) => !used.has(j) && !picked.includes(j) && !SINGLES.has(cart[j].accessType) && cart[j].subjectId === subjectId);
      if (i !== undefined) picked.push(i);
    }
    if (picked.length < need) return null;
    const amount = picked.reduce((sum, i) => sum + lineDiscount(cart[i].price, rule.percentOff, currency), 0);
    return { ruleId: rule.id, lines: picked, amount };
  };

  // ponytail: exhaustive search over rule applications, fine for a cart of a few subjects; memoise on `used` if carts grow.
  // Per rule it picks the priciest free line per subject, so two rules competing for different lines of one subject can miss the optimum.
  // A tiered rule claims every subject it matches, which can miss an optimum when another rule wants one of those lines.
  // A rule with no subjects, or a tier of zero, would apply forever, so it never takes part.
  const usable = rules.filter((r) => r.subjectIds.length > 0 && (r.minSubjects ?? 1) > 0);
  const best = (used: Set<number>, ruleIndex: number): Plan => {
    if (ruleIndex === usable.length) return { amount: 0, applications: [] };
    let plan = best(used, ruleIndex + 1);
    const app = tryApply(usable[ruleIndex], used);
    if (app) {
      const rest = best(new Set([...used, ...app.lines]), ruleIndex);
      if (app.amount + rest.amount > plan.amount) {
        plan = { amount: app.amount + rest.amount, applications: [app, ...rest.applications] };
      }
    }
    return plan;
  };

  const plan = best(new Set(), 0);
  const rulesById = new Map(rules.map((r) => [r.id, r]));
  const discounts = new Map<number, number>();
  for (const app of plan.applications) {
    const pct = rulesById.get(app.ruleId)!.percentOff;
    for (const i of app.lines) discounts.set(i, lineDiscount(cart[i].price, pct, currency));
  }

  const subtotal = cart.reduce((sum, l) => sum + l.price, 0);
  return {
    currency,
    subtotal,
    discount: plan.amount,
    couponDiscount: 0,
    platformDiscount: 0,
    total: subtotal - plan.amount,
    lines: cart.map((l, i) => ({ skuId: l.skuId, price: l.price, discount: discounts.get(i) ?? 0, couponDiscount: 0, platformDiscount: 0 })),
    applied: plan.applications.map((a) => ({ ruleId: a.ruleId, skuIds: a.lines.map((i) => cart[i].skuId), amount: a.amount })),
  };
}

/** The price charged today: the temporary price inside [discountFrom, discountTo), otherwise the normal price. */
export function effectivePrice(s: Priceable, now: Date): number {
  if (s.discountPrice == null || s.discountPrice >= s.price) return s.price;
  if (s.discountFrom && now < s.discountFrom) return s.price;
  if (s.discountTo && now >= s.discountTo) return s.price;
  return s.discountPrice;
}

/** The percent shown on a badge, or null when the temporary price is not active. */
export function discountPercent(s: Priceable, now: Date): number | null {
  const p = effectivePrice(s, now);
  if (p >= s.price || s.price <= 0) return null;
  const pct = Math.round((1 - p / s.price) * 100);
  return pct > 0 ? pct : null;
}

/** The SKU a card should advertise: the lowest effective price today, within one currency group. */
export function cheapestSku<T extends Priceable & { currency?: Currency }>(skus: readonly T[], now: Date): T | undefined {
  const currency = skus[0]?.currency;
  let best: T | undefined;
  for (const s of skus) {
    if (currency && s.currency && s.currency !== currency) continue;
    if (!best || effectivePrice(s, now) < effectivePrice(best, now)) best = s;
  }
  return best;
}

/** Spreads an amount across lines, capped per line, in currency steps. The largest line absorbs rounding. */
function spreadAcross(available: number[], amount: number, step: number): number[] {
  const shares = available.map(() => 0);
  const total = available.reduce((sum, n) => sum + n, 0);
  if (amount <= 0 || total <= 0) return shares;
  const order = available.map((_, i) => i).sort((a, b) => available[b] - available[a]);
  let left = amount;
  for (const i of order) {
    if (left <= 0) break;
    const proportional = Math.floor((amount * available[i]) / total / step) * step;
    const share = Math.min(available[i], proportional, left);
    shares[i] = share;
    left -= share;
  }
  for (const i of order) {
    if (left <= 0) break;
    const extra = Math.min(available[i] - shares[i], left);
    shares[i] += extra;
    left -= extra;
  }
  return shares;
}

/**
 * Applies a coupon after bundles, to what is left to pay. The amount is spread across lines so every
 * per-line charge stays on the currency's step and the lines still add up to `total` (the gateways verify it).
 */
export function applyCoupon(cart: PricedCart, coupon: CouponLike): PricedCart {
  if (cart.total <= 0) return cart;
  const step = minorPerUnit(cart.currency) / 100;
  const round = (n: number) => Math.round(n / step) * step;

  let amount: number;
  if (coupon.percentOff) {
    amount = round((cart.total * coupon.percentOff) / 100);
  } else if (coupon.amountOff) {
    if (coupon.currency && coupon.currency !== cart.currency) throw new PricingError("coupon_currency");
    amount = coupon.amountOff;
  } else return cart;
  amount = Math.min(Math.max(0, amount), cart.total);
  if (amount === 0) return cart;

  const available = cart.lines.map((l) => l.price - l.discount - l.platformDiscount);
  const shares = spreadAcross(available, amount, step);

  return {
    ...cart,
    discount: cart.discount + amount,
    couponDiscount: amount,
    total: cart.total - amount,
    lines: cart.lines.map((l, i) => ({ ...l, couponDiscount: shares[i] })),
  };
}

/**
 * A platform-funded discount: teacher pay stays calculated on the pre-discount line, and the
 * platform's own share absorbs it. Each line is capped at the platform's share, so `platformFee`
 * can never go negative. Returns the cart unchanged when the cap leaves nothing to apply.
 */
export function applyPlatformDiscount(cart: PricedCart, percentOff: number, platformShareBp: number): PricedCart {
  if (cart.total <= 0 || percentOff <= 0) return cart;
  const step = minorPerUnit(cart.currency) / 100;
  const round = (n: number) => Math.round(n / step) * step;
  const requested = Math.min(round((cart.total * Math.min(100, percentOff)) / 100), cart.total);
  const caps = cart.lines.map((l) => round(((l.price - l.discount - l.couponDiscount) * platformShareBp) / 10_000));
  const amount = Math.min(requested, caps.reduce((sum, n) => sum + n, 0));
  if (amount <= 0) return cart;

  const shares = spreadAcross(caps, amount, step);
  return {
    ...cart,
    platformDiscount: cart.platformDiscount + amount,
    total: cart.total - amount,
    lines: cart.lines.map((l, i) => ({ ...l, platformDiscount: l.platformDiscount + shares[i] })),
  };
}
