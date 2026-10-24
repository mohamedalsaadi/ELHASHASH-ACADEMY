import { describe, expect, it } from "vitest";
import { price, PricingError, type CartLine, type BundleRule } from "./pricing-engine";

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

const rule = (id: string, subjectIds: string[], percentOff: number): BundleRule => ({ id, subjectIds, percentOff });

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

  it("never bundles a lecture rental", () => {
    const rental = line("physics", 5000, { accessType: "RENTAL" });
    const r = price([line("math", 50000), rental], [rule("mp", ["math", "physics"], 15)], now);
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
