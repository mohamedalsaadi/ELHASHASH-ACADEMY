import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ db: {} }));

import type { Coupon } from "@/generated/prisma/client";
import { price, type CartLine } from "./pricing-engine";
import { planReward, type RewardSku } from "./referral-reward";

const NOW = new Date("2026-11-18T10:00:00Z");
const reward = { id: "rw1", code: "RW-X", percentOff: 5, funding: "PLATFORM", ownerId: "u1" } as Coupon;
const line = (skuId: string, p: number): CartLine => ({ skuId, courseId: `course-${skuId}`, subjectId: skuId, accessType: "SEMESTER", price: p, currency: "AED" });
const sku = (skuId: string, p: number, over: Partial<RewardSku> = {}): [string, RewardSku] => [skuId, { courseId: `course-${skuId}`, price: p, ...over }];

describe("planReward", () => {
  it("takes 5% off one course: the one with the most to pay", () => {
    const priced = price([line("a", 10_000), line("b", 30_000)], [], NOW);
    const r = planReward(reward, priced, new Map([sku("a", 10_000), sku("b", 30_000)]), 3000, NOW);
    expect(r).toMatchObject({ kind: "applied", courseId: "course-b" });
    if (r?.kind !== "applied") throw new Error("expected applied");
    expect(r.priced.total).toBe(40_000 - 1_500);
    expect(r.priced.lines.find((l) => l.skuId === "a")?.platformDiscount).toBe(0);
  });

  it("is saved, not applied, when a bundle already discounts the cart", () => {
    const rules = [{ id: "r1", subjectIds: ["a", "b"], percentOff: 10 }];
    const priced = price([line("a", 10_000), line("b", 10_000)], rules, NOW);
    expect(priced.discount).toBeGreaterThan(0);
    expect(planReward(reward, priced, new Map([sku("a", 10_000), sku("b", 10_000)]), 3000, NOW)).toEqual({ kind: "saved", coupon: reward });
  });

  it("is saved when a package has a temporary price running", () => {
    const priced = price([line("a", 8_000)], [], NOW);
    const skus = new Map([sku("a", 10_000, { discountPrice: 8_000, discountFrom: null, discountTo: null })]);
    expect(planReward(reward, priced, skus, 3000, NOW)?.kind).toBe("saved");
  });

  it("is saved when a coupon or earlier platform discount is already in the price", () => {
    const priced = { ...price([line("a", 10_000)], [], NOW), platformDiscount: 500 };
    expect(planReward(reward, priced, new Map([sku("a", 10_000)]), 3000, NOW)?.kind).toBe("saved");
  });

  it("changes nothing when the platform share leaves no room", () => {
    const priced = price([line("a", 10_000)], [], NOW);
    expect(planReward(reward, priced, new Map([sku("a", 10_000)]), 0, NOW)).toBeNull();
  });
});
