import { describe, expect, it } from "vitest";
import { applyCoupon, applyPlatformDiscount, cheapestSku, discountPercent, effectivePrice, price, PricingError, type CartLine, type BundleRule } from "./pricing-engine";

const now = new Date("2026-05-01T12:00:00Z");

const line = (subjectId: string, amount: number, extra: Partial<CartLine> = {}): CartLine => ({
  skuId: `sku-${subjectId}-${extra.accessType ?? "SEMESTER"}-${amount}`,
  courseId: `course-${subjectId}`,
  subjectId,
  accessType: "SEMESTER",
  price: amount,
  currency: "EGP",
  ...extra,
});

const rule = (id: string, subjectIds: string[], percentOff: number, minSubjects: number | null = null): BundleRule => ({
  id,
  subjectIds,
  percentOff,
  minSubjects,
});

describe("price", () => {
  it("charges a single line at its price", () => {
    const r = price([line("math", 50000)], [], now);
    expect(r).toMatchObject({ currency: "EGP", subtotal: 50000, discount: 0, total: 50000, applied: [] });
  });

  it("applies a subject bundle when every subject is in the cart", () => {
    const r = price([line("math", 50000), line("physics", 40000)], [rule("mp", ["math", "physics"], 15)], now);
    expect(r.discount).toBe(13500);
    expect(r.total).toBe(76500);
    expect(r.applied).toEqual([{ ruleId: "mp", skuIds: ["sku-math-SEMESTER-50000", "sku-physics-SEMESTER-40000"], amount: 13500 }]);
  });

  it("skips a bundle when one of its subjects is missing", () => {
    const r = price([line("math", 50000)], [rule("mp", ["math", "physics"], 15)], now);
    expect(r.discount).toBe(0);
  });

  it("uses each line in at most one bundle and picks the larger saving", () => {
    const cart = [line("math", 50000), line("physics", 40000), line("chem", 30000)];
    const rules = [rule("mp", ["math", "physics"], 15), rule("mc", ["math", "chem"], 20), rule("mpc", ["math", "physics", "chem"], 10)];
    const r = price(cart, rules, now);
    expect(r.applied.map((a) => a.ruleId)).toEqual(["mc"]);
    expect(r.discount).toBe(16000);
  });

  it("finds the best combination where greedy picking would lose", () => {
    const cart = [line("math", 10000), line("physics", 10000), line("chem", 10000), line("english", 10000)];
    const rules = [rule("mp", ["math", "physics"], 20), rule("mc", ["math", "chem"], 15), rule("pe", ["physics", "english"], 15)];
    const r = price(cart, rules, now);
    expect(r.discount).toBe(6000);
    expect(r.applied.map((a) => a.ruleId).sort()).toEqual(["mc", "pe"]);
  });

  it("applies two disjoint bundles together", () => {
    const cart = [line("math", 10000), line("physics", 10000), line("arabic", 8000), line("english", 8000)];
    const rules = [rule("mp", ["math", "physics"], 15), rule("ae", ["arabic", "english"], 10)];
    expect(price(cart, rules, now).discount).toBe(3000 + 1600);
  });

  it("bundles the pricier line when a subject appears twice", () => {
    const cart = [line("math", 30000, { courseId: "math-a" }), line("math", 60000, { courseId: "math-b" }), line("physics", 40000)];
    const r = price(cart, [rule("mp", ["math", "physics"], 10)], now);
    expect(r.discount).toBe(10000);
    expect(r.applied[0].skuIds).toContain("sku-math-SEMESTER-60000");
  });

  it("rounds each line's discount to the nearest minor unit", () => {
    const r = price([line("math", 33333), line("physics", 33333)], [rule("mp", ["math", "physics"], 15)], now);
    expect(r.discount).toBe(10000);
    expect(r.lines.map((l) => l.discount)).toEqual([5000, 5000]);
  });

  it("sells a REVISION pack only inside its sale window [from, to)", () => {
    const revision = line("math", 20000, {
      accessType: "REVISION",
      saleFrom: new Date("2026-05-01T00:00:00Z"),
      saleTo: new Date("2026-06-15T00:00:00Z"),
    });
    expect(price([revision], [], now).total).toBe(20000);
    expect(() => price([revision], [], new Date("2026-04-30T23:59:59Z"))).toThrow(new PricingError("sku_not_on_sale"));
    expect(() => price([revision], [], new Date("2026-06-15T00:00:00Z"))).toThrow(new PricingError("sku_not_on_sale"));
  });

  it.each(["RENTAL", "LIVE"] as const)("never bundles a %s line", (accessType) => {
    const single = line("physics", 5000, { accessType });
    const r = price([line("math", 50000), single], [rule("mp", ["math", "physics"], 15)], now);
    expect(r.discount).toBe(0);
    expect(r.total).toBe(55000);
  });

  it("ignores a rule with no subjects", () => {
    expect(price([line("math", 10000)], [rule("empty", [], 50)], now).discount).toBe(0);
  });

  it("rejects an empty cart, mixed currencies and duplicate SKUs", () => {
    expect(() => price([], [], now)).toThrow(new PricingError("empty_cart"));
    expect(() => price([line("math", 100), line("physics", 100, { currency: "AED" })], [], now)).toThrow(new PricingError("mixed_currency"));
    expect(() => price([line("math", 100), line("math", 100)], [], now)).toThrow(new PricingError("duplicate_sku"));
  });
});

describe("tiered bundles", () => {
  const subjects = ["math", "physics", "chem"];

  it("applies once the tier threshold is met, to every subject it matched", () => {
    const r = price([line("math", 45000), line("physics", 30000)], [rule("two", subjects, 15, 2)], now);
    expect(r.discount).toBe(11250);
    expect(r.total).toBe(63750);
    expect(r.applied).toEqual([{ ruleId: "two", skuIds: ["sku-math-SEMESTER-45000", "sku-physics-SEMESTER-30000"], amount: 11250 }]);
  });

  it("takes the higher tier when a third subject appears, never both", () => {
    const cart = [line("math", 45000), line("physics", 45000), line("chem", 45000)];
    const rules = [rule("two", subjects, 15, 2), rule("three", subjects, 20, 3)];
    const r = price(cart, rules, now);
    expect(r.applied.map((a) => a.ruleId)).toEqual(["three"]);
    expect(r.discount).toBe(27000);
    expect(r.total).toBe(108000);
  });

  it("falls back to the lower tier when the higher one cannot be met", () => {
    const cart = [line("math", 45000), line("physics", 45000)];
    const r = price(cart, [rule("two", subjects, 15, 2), rule("three", subjects, 20, 3)], now);
    expect(r.applied.map((a) => a.ruleId)).toEqual(["two"]);
    expect(r.discount).toBe(13500);
    expect(r.total).toBe(76500);
  });

  it("counts subjects, not lines: two math courses do not make a pair", () => {
    const cart = [line("math", 30000, { courseId: "math-a" }), line("math", 60000, { courseId: "math-b" }), line("physics", 40000)];
    const r = price(cart, [rule("two", subjects, 15, 2)], now);
    expect(r.discount).toBe(15000);
    expect(r.applied[0].skuIds).toEqual(["sku-math-SEMESTER-60000", "sku-physics-SEMESTER-40000"]);
    expect(r.lines.find((l) => l.skuId === "sku-math-SEMESTER-30000")?.discount).toBe(0);
  });

  it("does not let a rental or a live seat fill a tier slot", () => {
    const r = price([line("math", 45000), line("physics", 5000, { accessType: "RENTAL" })], [rule("two", subjects, 15, 2)], now);
    expect(r.discount).toBe(0);
  });

  it("ignores a zero tier and an empty subject set without looping", () => {
    expect(price([line("math", 10000)], [rule("zero", subjects, 50, 0)], now).discount).toBe(0);
    expect(price([line("math", 10000)], [rule("empty", [], 50, 2)], now).discount).toBe(0);
  });

  it("still takes a coupon after the tier", () => {
    const cart = price(
      [line("math", 45000), line("physics", 45000), line("chem", 45000)],
      [rule("three", subjects, 20, 3)],
      now,
    );
    const r = applyCoupon(cart, { percentOff: 10, amountOff: null, currency: null });
    expect(r.couponDiscount).toBe(10800);
    expect(r.total).toBe(97200);
    expect(r.lines.reduce((sum, l) => sum + l.price - l.discount - l.couponDiscount, 0)).toBe(r.total);
  });
});

describe("sale prices", () => {
  const sku = {
    price: 50000,
    discountPrice: 40000,
    discountFrom: new Date("2026-05-01T00:00:00Z"),
    discountTo: new Date("2026-05-10T00:00:00Z"),
  };

  it("uses the temporary price inside [from, to)", () => {
    expect(effectivePrice(sku, new Date("2026-05-01T00:00:00Z"))).toBe(40000);
    expect(effectivePrice(sku, new Date("2026-05-09T23:59:59Z"))).toBe(40000);
  });

  it("uses the normal price outside the window", () => {
    expect(effectivePrice(sku, new Date("2026-04-30T23:59:59Z"))).toBe(50000);
    expect(effectivePrice(sku, new Date("2026-05-10T00:00:00Z"))).toBe(50000);
  });

  it("ignores a temporary price that is not lower", () => {
    expect(effectivePrice({ price: 100, discountPrice: 120 }, now)).toBe(100);
  });

  it("reports the percent off only while the sale runs", () => {
    expect(discountPercent(sku, new Date("2026-05-02T00:00:00Z"))).toBe(20);
    expect(discountPercent(sku, new Date("2026-06-01T00:00:00Z"))).toBeNull();
  });

  it("picks the cheapest SKU by effective price", () => {
    const a = { id: "a", price: 50000 };
    const b = { id: "b", price: 60000, discountPrice: 30000, discountFrom: sku.discountFrom, discountTo: sku.discountTo };
    expect(cheapestSku([a, b], now)?.id).toBe("b");
    expect(cheapestSku([a, b], new Date("2026-07-01T00:00:00Z"))?.id).toBe("a");
  });

  it("never compares prices across currencies", () => {
    const aed = { id: "aed", price: 40000, currency: "AED" as const };
    const egp = { id: "egp", price: 4000, currency: "EGP" as const };
    expect(cheapestSku([aed, egp], now)?.id).toBe("aed");
    expect(cheapestSku([egp, aed], now)?.id).toBe("egp");
  });
});

describe("applyCoupon", () => {
  // 50000 + 40000 with a 15% bundle = 76500 to pay.
  const cart = price([line("math", 50000), line("physics", 40000)], [rule("mp", ["math", "physics"], 15)], now);
  const netOf = (r: typeof cart) => r.lines.reduce((sum, l) => sum + l.price - l.discount - l.couponDiscount, 0);

  it("takes a percent after the bundle and keeps the lines adding up", () => {
    const r = applyCoupon(cart, { percentOff: 10, amountOff: null, currency: null });
    expect(r.couponDiscount).toBe(7650);
    expect(r.discount).toBe(21150);
    expect(r.total).toBe(68850);
    expect(netOf(r)).toBe(r.total);
  });

  it("caps a fixed coupon at what is left", () => {
    const r = applyCoupon(cart, { percentOff: null, amountOff: 1_000_000, currency: "EGP" });
    expect(r.couponDiscount).toBe(76500);
    expect(r.total).toBe(0);
    expect(netOf(r)).toBe(0);
  });

  it("rejects a fixed coupon in another currency", () => {
    expect(() => applyCoupon(cart, { percentOff: null, amountOff: 100, currency: "AED" })).toThrow(new PricingError("coupon_currency"));
  });

  it("keeps 3-decimal currencies on 10-fil steps", () => {
    const kwd = price([line("math", 3000, { currency: "KWD" }), line("physics", 3000, { currency: "KWD" })], [], now);
    const r = applyCoupon(kwd, { percentOff: 33, amountOff: null, currency: null });
    expect(r.total % 10).toBe(0);
    for (const l of r.lines) expect(l.couponDiscount % 10).toBe(0);
    expect(netOf(r)).toBe(r.total);
  });

  it("returns the cart untouched without a coupon", () => {
    expect(applyCoupon(cart, { percentOff: null, amountOff: null, currency: null })).toBe(cart);
  });
});

describe("applyPlatformDiscount", () => {
  const cart = price([line("math", 50000), line("physics", 40000)], [], now);
  const perLine = (r: typeof cart) => r.lines.reduce((sum, l) => sum + l.platformDiscount, 0);

  it("takes the welcome discount out of the platform share, not the teacher", () => {
    const r = applyPlatformDiscount(cart, 10, 3000);
    expect(r.platformDiscount).toBe(9_000);
    expect(r.total).toBe(81_000);
    expect(perLine(r)).toBe(9_000);
  });

  it("never takes more than the platform share", () => {
    const r = applyPlatformDiscount(cart, 100, 3000);
    expect(r.platformDiscount).toBe(27_000);
    expect(r.total).toBe(63_000);
    expect(perLine(r)).toBe(27_000);
  });

  it("keeps the spread on the currency step", () => {
    const kwd = price([line("math", 30_000, { currency: "KWD" })], [], now);
    const r = applyPlatformDiscount(kwd, 10, 3000);
    expect(r.total % 10).toBe(0);
    expect(r.platformDiscount).toBe(3_000);
    for (const l of r.lines) expect(l.platformDiscount % 10).toBe(0);
  });
});
