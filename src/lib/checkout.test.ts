import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  skus: [] as unknown[],
  db: {
    sku: { findMany: async () => h.skus },
    bundleRule: { findMany: async () => [] },
    fxRate: { findUnique: async () => null },
  },
}));
vi.mock("@/lib/db", () => ({ db: h.db }));

import { priceSkus } from "./checkout";

const sku = (over: Record<string, unknown> = {}) => ({
  id: "sku-1",
  courseId: "course-1",
  accessType: "SEMESTER",
  price: 50_000,
  currency: "SAR",
  aedPrice: 44_000,
  discountPrice: null,
  discountFrom: null,
  discountTo: null,
  saleFrom: null,
  saleTo: null,
  course: { subjectId: "math", grade: { country: { code: "SA", currency: "SAR" } } },
  lesson: null,
  liveSession: null,
  ...over,
});

const now = new Date("2026-05-01T00:00:00Z");

beforeEach(() => {
  h.skus = [];
});

describe("priceSkus", () => {
  it("charges the discounted AED price while a temporary discount is active", async () => {
    h.skus = [sku({ discountPrice: 40_000, discountTo: new Date("2026-06-01T00:00:00Z") })];
    const { priced } = await priceSkus(["sku-1"], now);
    expect(priced.total).toBe(35_200);
  });

  it("refuses a SKU whose sale window has closed", async () => {
    h.skus = [sku({ saleTo: new Date("2026-04-01T00:00:00Z") })];
    await expect(priceSkus(["sku-1"], now)).rejects.toThrow("sku_not_on_sale");
  });

  it("refuses a SKU whose sale window has not opened", async () => {
    h.skus = [sku({ saleFrom: new Date("2026-06-01T00:00:00Z") })];
    await expect(priceSkus(["sku-1"], now)).rejects.toThrow("sku_not_on_sale");
  });
});
