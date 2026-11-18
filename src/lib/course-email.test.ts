import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
process.env.APP_URL = "https://dhirwa.ae";

import { renderCourseEmail, type CourseEmailData } from "./course-email";

const now = new Date("2026-11-18T10:00:00Z");
const lesson = (id: string, skus: unknown[] = []) => ({ id, titleAr: `درس ${id}`, titleEn: `Lesson ${id}`, kind: "VIDEO", month: 1, order: 1, skus });
const sku = (id: string, accessType: string, price: number, over: Record<string, unknown> = {}) => ({
  id, accessType, price, currency: "AED", aedPrice: null, discountPrice: null, discountFrom: null, discountTo: null, accessDays: 30, accessEndsAt: null, month: accessType === "MONTHLY" ? 1 : null, term: accessType === "SEMESTER" ? 1 : null, ...over,
});

function data(over: { units?: unknown[]; skus?: unknown[]; live?: unknown[]; coverKey?: string | null } = {}): CourseEmailData {
  return {
    now,
    fxRate: null,
    course: {
      id: "c1",
      slug: "ae-12-adv-math",
      titleAr: "هيكل الرياضيات",
      titleEn: "Math exam structure",
      headlineAr: null,
      headlineEn: "Solved question by question",
      descAr: null,
      descEn: "Four videos and a file.",
      coverKey: over.coverKey === undefined ? "covers/x/v1.jpg" : over.coverKey,
      grade: { nameAr: "الثاني عشر", nameEn: "Grade 12", country: { currency: "AED", timeZone: "Asia/Dubai", code: "AE" } },
      instructor: { id: "t1", name: "Sayed", photoUrl: null, liveApproved: true },
      liveSessions: over.live ?? [],
      units: over.units ?? [
        { id: "u1", isFree: true, term: 1, order: 1, titleAr: "وحدة", titleEn: "Free unit", lessons: [lesson("free1")] },
        { id: "u2", isFree: false, term: 1, order: 2, titleAr: "مدفوعة", titleEn: "Paid unit", lessons: [lesson("paid1", [sku("rent1", "RENTAL", 2_000)])] },
      ],
      skus: over.skus ?? [sku("m1", "MONTHLY", 9_900), sku("t1", "SEMESTER", 24_900)],
    },
  } as never;
}

describe("renderCourseEmail", () => {
  const html = renderCourseEmail(data(), "en", { intro: "A course for you", unsubscribe: "https://dhirwa.ae/api/unsubscribe?u=1" });

  it("is a copy of the course page: title, cover, teacher, units and plans", () => {
    expect(html).toContain("Math exam structure");
    expect(html).toContain("https://dhirwa.ae/api/covers/c1?v=v1.jpg");
    expect(html).toContain("Sayed");
    expect(html).toContain("Free unit");
    expect(html).toContain("Paid unit");
    expect(html).toContain("1 month");
    expect(html).toContain("Full semester");
    expect(html).toContain("A course for you");
  });

  it("carries the subscribe links: the page, each plan's checkout, a free lesson and a rental", () => {
    expect(html).toContain("https://dhirwa.ae/en/courses/ae-12-adv-math#packages");
    expect(html).toContain("https://dhirwa.ae/en/checkout?sku=m1");
    expect(html).toContain("https://dhirwa.ae/en/checkout?sku=t1");
    expect(html).toContain("https://dhirwa.ae/en/checkout?sku=rent1");
    expect(html).toContain("https://dhirwa.ae/en/courses/ae-12-adv-math/lessons/free1");
  });

  it("has no site header or footer banner, only the unsubscribe link", () => {
    expect(html).not.toContain("Every lesson is a step toward the peak");
    expect(html).not.toContain("كل درس خطوة نحو الذروة");
    expect(html).not.toMatch(/>Dhirwa<span/);
    expect(html).toContain("https://dhirwa.ae/api/unsubscribe?u=1");
  });

  it("reads right to left in Arabic and links to the Arabic pages", () => {
    const arHtml = renderCourseEmail(data(), "ar", { unsubscribe: "https://x/u" });
    expect(arHtml).toContain('dir="rtl"');
    expect(arHtml).toContain("هيكل الرياضيات");
    expect(arHtml).toContain("https://dhirwa.ae/ar/checkout?sku=m1");
  });

  it("escapes course text", () => {
    const d = data();
    (d.course as { titleEn: string }).titleEn = "<script>x</script>";
    expect(renderCourseEmail(d, "en", { unsubscribe: "u" })).not.toContain("<script>x");
  });

  it("caps a long lesson list and links to the rest", () => {
    const many = Array.from({ length: 90 }, (_, i) => lesson(`l${i}`, [sku(`r${i}`, "RENTAL", 1_000)]));
    const long = renderCourseEmail(data({ units: [{ id: "u", isFree: false, term: 1, order: 1, titleAr: "ط", titleEn: "Big unit", lessons: many }] }), "en", { unsubscribe: "u" });
    expect(long.match(/checkout\?sku=r\d+/g)?.length).toBe(60);
    expect(long).toContain("+30");
  });

  it("says when there is nothing to buy yet", () => {
    const none = renderCourseEmail(data({ skus: [], units: [] }), "en", { unsubscribe: "u" });
    expect(none).toContain("being prepared");
  });
});
