import { db } from "@/lib/db";
import { effectivePrice, price, PricingError } from "@/lib/pricing-engine";

/** Loads purchasable SKUs and active bundle rules, then prices them. Throws PricingError on an invalid cart. */
export async function priceSkus(skuIds: string[], now = new Date()) {
  const [skus, rules] = await Promise.all([
    // A live seat is only purchasable while its teacher is approved for live.
    db.sku.findMany({
      where: {
        id: { in: skuIds },
        active: true,
        course: { published: true },
        AND: [{ OR: [{ liveSessionId: null }, { liveSession: { course: { instructor: { liveApproved: true } } } }] }],
      },
      include: {
        course: { include: { grade: { select: { country: { select: { code: true, currency: true } } } } } },
        lesson: true,
        liveSession: true,
      },
    }),
    db.bundleRule.findMany({ where: { active: true }, include: { subjects: { select: { id: true } } } }),
  ]);
  // A package belongs to its course country's market. Until the historical rows are cleaned, report the
  // drift; STRICT_CURRENCY=1 turns the report into a refusal so a wrong-currency cart cannot be charged.
  const drift = skus.flatMap((s) => {
    const expected = s.course.grade?.country.currency;
    return expected && s.currency !== expected ? [{ skuId: s.id, currency: s.currency, expected }] : [];
  });
  if (drift.length > 0) {
    const detail = drift.map((d) => `${d.skuId}: ${d.currency} != ${d.expected}`).join(", ");
    if (process.env.STRICT_CURRENCY === "1") throw new PricingError("currency_mismatch");
    console.warn(`[pricing] SKU currency differs from its course country: ${detail}`);
  }
  const unique = new Set(skuIds);
  const priced = price(
    skus.map((s) => ({
      skuId: s.id,
      courseId: s.courseId,
      subjectId: s.course.subjectId,
      accessType: s.accessType,
      price: effectivePrice(s, now),
      currency: s.currency,
      saleFrom: s.saleFrom,
      saleTo: s.saleTo,
    })),
    rules.map((r) => ({ id: r.id, percentOff: r.percentOff, minSubjects: r.minSubjects, subjectIds: r.subjects.map((s) => s.id) })),
    now,
  );
  return {
    priced,
    skus: new Map(skus.map((s) => [s.id, s])),
    missing: skus.length !== unique.size,
    countryCode: skus[0]?.course.grade?.country.code ?? null,
  };
}
