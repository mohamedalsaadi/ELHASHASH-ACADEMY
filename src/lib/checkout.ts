import { db } from "@/lib/db";
import { price } from "@/lib/pricing-engine";

export type Method = "CARD" | "WALLET" | "KIOSK" | "VALU";

// Paymob (Egyptian wallets, kiosk cash, valU) when its keys are set, otherwise Stripe for cards.
export function activeGateway(): { gateway: "PAYMOB" | "STRIPE"; methods: Method[] } {
  if (process.env.PAYMOB_SECRET_KEY) return { gateway: "PAYMOB", methods: ["CARD", "WALLET", "KIOSK", "VALU"] };
  return { gateway: "STRIPE", methods: ["CARD"] };
}

/** Loads purchasable SKUs and active bundle rules, then prices them. Throws PricingError on an invalid cart. */
export async function priceSkus(skuIds: string[], now = new Date()) {
  const [skus, rules] = await Promise.all([
    db.sku.findMany({ where: { id: { in: skuIds }, active: true, course: { published: true } }, include: { course: true, lesson: true } }),
    db.bundleRule.findMany({ where: { active: true }, include: { subjects: { select: { id: true } } } }),
  ]);
  const unique = new Set(skuIds);
  const priced = price(
    skus.map((s) => ({
      skuId: s.id,
      courseId: s.courseId,
      subjectId: s.course.subjectId,
      accessType: s.accessType,
      price: s.price,
      currency: s.currency,
      saleFrom: s.saleFrom,
      saleTo: s.saleTo,
    })),
    rules.map((r) => ({ id: r.id, percentOff: r.percentOff, subjectIds: r.subjects.map((s) => s.id) })),
    now,
  );
  return { priced, skus: new Map(skus.map((s) => [s.id, s])), missing: skus.length !== unique.size };
}
