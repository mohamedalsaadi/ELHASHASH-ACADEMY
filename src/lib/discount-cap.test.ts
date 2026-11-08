import { describe, expect, it } from "vitest";
import { discountAllowed } from "./discount-cap";

describe("discountAllowed", () => {
  it("allows up to the cap and no more", () => {
    expect(discountAllowed(10000, 9000, 10)).toBe(true);
    expect(discountAllowed(10000, 8999, 10)).toBe(false);
    expect(discountAllowed(10000, 5000, 50)).toBe(true);
  });
  it("treats a price at or above the list price as no discount", () => {
    expect(discountAllowed(10000, 10000, 0)).toBe(true);
    expect(discountAllowed(10000, 12000, 0)).toBe(true);
  });
  it("blocks any real discount at a 0% cap", () => {
    expect(discountAllowed(10000, 9999, 0)).toBe(false);
  });
});
