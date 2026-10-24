import { minorPerUnit } from "./format";

export type AccessType = "SEMESTER" | "YEARLY" | "REVISION" | "FIXED_DAYS" | "RENTAL" | "LIVE";
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

export type BundleRule = { id: string; subjectIds: string[]; percentOff: number };

export type PricedCart = {
  currency: Currency;
  subtotal: number;
  discount: number;
  total: number;
  lines: { skuId: string; price: number; discount: number }[];
  applied: { ruleId: string; skuIds: string[]; amount: number }[];
};

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
 * Bundles: each rule discounts one line per subject in the rule; a line joins at most one bundle, rentals and live seats join none,
 * a rule may apply more than once, and the combination with the largest total saving wins.
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
    const picked: number[] = [];
    for (const subjectId of rule.subjectIds) {
      const i = order.find((j) => !used.has(j) && !picked.includes(j) && !SINGLES.has(cart[j].accessType) && cart[j].subjectId === subjectId);
      if (i === undefined) return null;
      picked.push(i);
    }
    const amount = picked.reduce((sum, i) => sum + lineDiscount(cart[i].price, rule.percentOff, currency), 0);
    return { ruleId: rule.id, lines: picked, amount };
  };

  // ponytail: exhaustive search over rule applications, fine for a cart of a few subjects; memoise on `used` if carts grow.
  // Per rule it picks the priciest free line per subject, so two rules competing for different lines of one subject can miss the optimum.
  // An empty rule would apply forever, so it never takes part.
  const usable = rules.filter((r) => r.subjectIds.length > 0);
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
    total: subtotal - plan.amount,
    lines: cart.map((l, i) => ({ skuId: l.skuId, price: l.price, discount: discounts.get(i) ?? 0 })),
    applied: plan.applications.map((a) => ({ ruleId: a.ruleId, skuIds: a.lines.map((i) => cart[i].skuId), amount: a.amount })),
  };
}
