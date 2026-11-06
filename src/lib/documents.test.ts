import { describe, expect, it } from "vitest";
import { allocate, documentNumber } from "./documents";

describe("allocate", () => {
  it("splits every minor unit with the largest remainders first", () => {
    const shares = allocate(500, [10_000, 9_000]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(500);
    expect(shares).toEqual([263, 237]);
  });

  it("returns zeros when there is nothing to split", () => {
    expect(allocate(0, [100, 200])).toEqual([0, 0]);
    expect(allocate(10, [0, 0])).toEqual([0, 0]);
  });

  it("never loses or invents a unit", () => {
    for (const total of [1, 2, 7, 99, 12_345]) {
      const shares = allocate(total, [1, 1, 1, 1]);
      expect(shares.reduce((a, b) => a + b, 0)).toBe(total);
      for (const s of shares) expect(s).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("documentNumber", () => {
  it("uses the country and year, zero-padded and gapless-looking", () => {
    expect(documentNumber("INVOICE", "AE", 2026, 123)).toBe("AE-2026-000123");
    expect(documentNumber("INVOICE", null, 2026, 1)).toBe("GL-2026-000001");
  });

  it("prefixes a credit note in its own series", () => {
    expect(documentNumber("CREDIT_NOTE", "AE", 2026, 1)).toBe("CN-AE-2026-000001");
  });
});
