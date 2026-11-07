// The signed-in student's home: every subject of their grade with its courses, what they already own,
// and the bundle saving the pricing engine would give them. Real rows only, nothing invented.
import type { CardCourse } from "../components/CourseCard";
import { cheapestSku, effectivePrice, price, type BundleRule, type Currency } from "./pricing-engine";

export type HomeSubjectInput = { id: string; slug: string; nameAr: string; nameEn: string; icon: string };
type Course = CardCourse & { subjectId: string | null };

export type HomeSubject = HomeSubjectInput & {
  courses: Course[];
  /** Cheapest price on sale today across the subject's courses, in minor units. */
  from: { amount: number; currency: Currency } | null;
  owned: boolean;
};

export type Bundle = { skuIds: string[]; subjectIds: string[]; subtotal: number; total: number; currency: Currency };

/** One rented lecture or a live seat never joins a bundle (same rule as the pricing engine). */
const SINGLE = new Set(["RENTAL", "LIVE"]);

export function buildHome(input: {
  subjects: HomeSubjectInput[];
  courses: Course[];
  ownedCourseIds: string[];
  rules: BundleRule[];
  now: Date;
}): { subjects: HomeSubject[]; owned: Course[]; bundle: Bundle | null } {
  const { now } = input;
  const owned = new Set(input.ownedCourseIds);

  const subjects = input.subjects.map((s) => {
    const courses = input.courses.filter((c) => c.subjectId === s.id);
    const cheapest = cheapestSku(
      courses.flatMap((c) => c.skus),
      now,
    );
    return {
      ...s,
      courses,
      from: cheapest ? { amount: effectivePrice(cheapest, now), currency: cheapest.currency } : null,
      owned: courses.some((c) => owned.has(c.id)),
    };
  });

  // For each subject the student does not have yet: the cheapest whole-course plan, then let the engine
  // decide which bundles apply. Only lines the engine actually discounts go in the offer.
  const lines = subjects
    .filter((s) => !s.owned)
    .flatMap((s) => {
      const options = s.courses.flatMap((c) => c.skus.filter((k) => !SINGLE.has(k.accessType)).map((k) => ({ k, c })));
      const pick = options.sort((a, b) => effectivePrice(a.k, now) - effectivePrice(b.k, now))[0];
      return pick
        ? [{ skuId: pick.k.id, courseId: pick.c.id, subjectId: s.id, accessType: pick.k.accessType, price: effectivePrice(pick.k, now), currency: pick.k.currency }]
        : [];
    });
  const ids = new Set(input.subjects.map((s) => s.id));
  const rules = input.rules.filter((r) => r.subjectIds.some((id) => ids.has(id)));

  let bundle: Bundle | null = null;
  const currency = lines[0]?.currency;
  const sameCurrency = lines.filter((l) => l.currency === currency);
  if (sameCurrency.length > 1 && rules.length > 0) {
    const priced = price(sameCurrency, rules, now);
    const skuIds = priced.applied.flatMap((a) => a.skuIds);
    if (skuIds.length > 0) {
      const chosen = priced.lines.filter((l) => skuIds.includes(l.skuId));
      bundle = {
        skuIds,
        subjectIds: sameCurrency.filter((l) => skuIds.includes(l.skuId)).map((l) => l.subjectId),
        subtotal: chosen.reduce((n, l) => n + l.price, 0),
        total: chosen.reduce((n, l) => n + l.price - l.discount, 0),
        currency: priced.currency,
      };
    }
  }

  return { subjects, owned: input.courses.filter((c) => owned.has(c.id)), bundle };
}

/**
 * Which country the home shows. The student's grade already says it, so a signed-up student is never asked;
 * the choice in the cookie covers a student with no grade yet. With nothing known and a choice of countries, it asks.
 */
export function resolveCountry(chosen: string | undefined, activeIds: string[], gradeCountryId?: string | null): { mode: "use"; countryId: string } | { mode: "ask" } {
  if (activeIds.length === 1) return { mode: "use", countryId: activeIds[0] };
  if (gradeCountryId && activeIds.includes(gradeCountryId)) return { mode: "use", countryId: gradeCountryId };
  if (chosen && activeIds.includes(chosen)) return { mode: "use", countryId: chosen };
  return { mode: "ask" };
}

/** The cookie that remembers the chosen country. */
export const RIDE_COUNTRY = "ride_country";
