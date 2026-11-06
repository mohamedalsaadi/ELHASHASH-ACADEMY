import { describe, expect, it } from "vitest";
import { aedFromRate, formatRate } from "./fx";

describe("aedFromRate", () => {
  it("converts 3-decimal OMR to AED fils", () => {
    // OMR 10.000 at 9.55 AED per OMR = AED 95.50.
    expect(aedFromRate(10_000, "OMR", 9.55)).toBe(9_550);
  });

  it("converts 2-decimal SAR to AED fils", () => {
    // SAR 400 at 0.9793 AED per SAR = AED 391.72.
    expect(aedFromRate(40_000, "SAR", 0.9793)).toBe(39_172);
  });

  it("rounds to the nearest fils", () => {
    expect(aedFromRate(1, "EGP", 0.075)).toBe(0);
    expect(aedFromRate(100, "EGP", 0.075)).toBe(8);
  });
});

describe("formatRate", () => {
  it("keeps the owner's precision without padding", () => {
    expect(formatRate(9.55, "en")).toBe("9.55");
    expect(formatRate(0.9793, "en")).toBe("0.9793");
  });

  it("uses Latin digits in Arabic", () => {
    expect(formatRate(9.55, "ar")).toBe("9.55");
  });
});
