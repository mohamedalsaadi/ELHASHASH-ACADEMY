import { describe, expect, it } from "vitest";
import { DEFAULT_FINANCE, splitLine, vatOn } from "./finance";

const cfg = (over: Partial<typeof DEFAULT_FINANCE> = {}) => ({ ...DEFAULT_FINANCE, ...over });

describe("splitLine", () => {
  it("takes 30% of the net and leaves 70% to the teacher when VAT is off", () => {
    expect(splitLine(9_900, cfg())).toMatchObject({
      gross: 9_900,
      vat: 0,
      net: 9_900,
      platformFee: 2_970,
      instructorNet: 6_930,
    });
  });

  it("adds VAT on top and still splits the net", () => {
    expect(splitLine(9_900, cfg({ vatEnabled: true, vatRateBp: 500 }))).toMatchObject({
      gross: 10_395,
      vat: 495,
      net: 9_900,
      platformFee: 2_970,
      instructorNet: 6_930,
    });
  });

  it("keeps the parts summing to the buyer-paid amount", () => {
    for (const net of [1, 99, 100, 9_900, 12_345, 999_999]) {
      for (const vatRateBp of [0, 500, 1500]) {
        const r = splitLine(net, cfg({ vatEnabled: vatRateBp > 0, vatRateBp }));
        expect(r.vat + r.net).toBe(r.gross);
        expect(r.platformFee + r.instructorNet).toBe(r.net);
      }
    }
  });

  it("holds the 3-decimal currencies in fils", () => {
    expect(splitLine(12_500, cfg())).toMatchObject({ platformFee: 3_750, instructorNet: 8_750 });
  });

  it("funds a discount from the platform share and leaves the teacher whole", () => {
    const r = splitLine(10_000, cfg({ vatEnabled: true, vatRateBp: 500 }), 1_000);
    expect(r).toMatchObject({
      instructorNet: 7_000,
      platformFee: 2_000,
      net: 9_000,
      vat: 450,
      gross: 9_450,
      platformDiscount: 1_000,
    });
  });

  it("caps a platform discount at the platform share", () => {
    const r = splitLine(10_000, cfg(), 99_999);
    expect(r).toMatchObject({ platformDiscount: 3_000, platformFee: 0, instructorNet: 7_000, net: 7_000 });
  });
});

describe("vatOn", () => {
  it("is zero while VAT is off, whatever the stored rate", () => {
    expect(vatOn(10_000, cfg({ vatRateBp: 1500 }))).toBe(0);
  });

  it("rounds to the nearest minor unit", () => {
    expect(vatOn(10_000, cfg({ vatEnabled: true, vatRateBp: 500 }))).toBe(500);
    expect(vatOn(100, cfg({ vatEnabled: true, vatRateBp: 1500 }))).toBe(15);
  });
});
