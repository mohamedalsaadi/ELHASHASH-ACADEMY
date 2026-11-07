import { describe, expect, it } from "vitest";
import { buildHome, resolveCountry } from "./student-home";

const now = new Date("2026-11-02T10:00:00Z");
const subject = (id: string) => ({ id, slug: id, nameAr: id, nameEn: id, icon: "book" });
const course = (id: string, subjectId: string, amount: number) =>
  ({
    id,
    subjectId,
    skus: [{ id: `${id}-sku`, accessType: "SEMESTER", price: amount, currency: "AED", discountPrice: null, discountFrom: null, discountTo: null }],
  }) as unknown as Parameters<typeof buildHome>[0]["courses"][number];

describe("buildHome", () => {
  const subjects = [subject("math"), subject("physics"), subject("arabic")];
  const courses = [course("m1", "math", 30000), course("m2", "math", 20000), course("p1", "physics", 25000)];

  it("keeps the grade's subject order and the cheapest price per subject", () => {
    const home = buildHome({ subjects, courses, ownedCourseIds: [], rules: [], now });
    expect(home.subjects.map((s) => s.id)).toEqual(["math", "physics", "arabic"]);
    expect(home.subjects[0].from).toEqual({ amount: 20000, currency: "AED" });
    expect(home.subjects[2]).toMatchObject({ courses: [], from: null, owned: false });
    expect(home.bundle).toBeNull();
  });

  it("marks owned subjects and leaves them out of the bundle", () => {
    const rules = [{ id: "r", subjectIds: ["math", "physics"], percentOff: 10 }];
    const mine = buildHome({ subjects, courses, ownedCourseIds: ["p1"], rules, now });
    expect(mine.subjects[1].owned).toBe(true);
    expect(mine.owned.map((c) => c.id)).toEqual(["p1"]);
    expect(mine.bundle).toBeNull();
  });

  it("offers the bundle the pricing engine gives, on the cheapest plan per subject", () => {
    const rules = [{ id: "r", subjectIds: ["math", "physics"], percentOff: 10 }];
    const home = buildHome({ subjects, courses, ownedCourseIds: [], rules, now });
    expect(home.bundle).toEqual({ skuIds: expect.arrayContaining(["m2-sku", "p1-sku"]), subjectIds: expect.arrayContaining(["math", "physics"]), subtotal: 45000, total: 40500, currency: "AED" });
  });

  it("ignores bundle rules for subjects outside the grade", () => {
    const rules = [{ id: "r", subjectIds: ["chemistry", "biology"], percentOff: 20 }];
    expect(buildHome({ subjects, courses, ownedCourseIds: [], rules, now }).bundle).toBeNull();
  });
});

describe("resolveCountry", () => {
  it("asks first when nothing is remembered and there is a choice", () => {
    expect(resolveCountry(undefined, ["ae", "eg"])).toEqual({ mode: "ask" });
  });
  it("uses the remembered country, but only while it is still active", () => {
    expect(resolveCountry("eg", ["ae", "eg"])).toEqual({ mode: "use", countryId: "eg" });
    expect(resolveCountry("sa", ["ae", "eg"])).toEqual({ mode: "ask" });
  });
  it("never asks a student whose grade already names the country, even over an old choice", () => {
    expect(resolveCountry(undefined, ["ae", "eg"], "eg")).toEqual({ mode: "use", countryId: "eg" });
    expect(resolveCountry("ae", ["ae", "eg"], "eg")).toEqual({ mode: "use", countryId: "eg" });
    expect(resolveCountry(undefined, ["ae", "eg"], "sa")).toEqual({ mode: "ask" });
  });
  it("skips the question when only one country is active", () => {
    expect(resolveCountry(undefined, ["ae"])).toEqual({ mode: "use", countryId: "ae" });
  });
});
