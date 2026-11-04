import { db } from "@/lib/db";
import { effectivePrice, price } from "@/lib/pricing-engine";

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
      include: { course: true, lesson: true, liveSession: true },
    }),
    db.bundleRule.findMany({ where: { active: true }, include: { subjects: { select: { id: true } } } }),
  ]);
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
  return { priced, skus: new Map(skus.map((s) => [s.id, s])), missing: skus.length !== unique.size };
}
