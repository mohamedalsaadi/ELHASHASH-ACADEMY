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
  total: number;
  lines: { skuId: string; price: number; discount: number; couponDiscount: number }[];
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
    total: subtotal - plan.amount,
    lines: cart.map((l, i) => ({ skuId: l.skuId, price: l.price, discount: discounts.get(i) ?? 0, couponDiscount: 0 })),
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

/** The SKU a card should advertise: the lowest effective price today. */
export function cheapestSku<T extends Priceable>(skus: readonly T[], now: Date): T | undefined {
  let best: T | undefined;
  for (const s of skus) if (!best || effectivePrice(s, now) < effectivePrice(best, now)) best = s;
  return best;
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

  const net = cart.lines.map((l) => l.price - l.discount);
  const order = net.map((_, i) => i).sort((a, b) => net[b] - net[a]);
  const shares = net.map(() => 0);
  let left = amount;
  for (const i of order) {
    if (!left) break;
    const share = Math.min(net[i], round((amount * net[i]) / cart.total), left);
    shares[i] = share;
    left -= share;
  }
  // Rounding can leave a multiple of the step; the largest remaining line absorbs it.
  for (const i of order) {
    if (!left) break;
    const extra = Math.min(net[i] - shares[i], left);
    shares[i] += extra;
    left -= extra;
  }

  return {
    ...cart,
    discount: cart.discount + amount,
    couponDiscount: amount,
    total: cart.total - amount,
    lines: cart.lines.map((l, i) => ({ ...l, couponDiscount: shares[i] })),
  };
}
