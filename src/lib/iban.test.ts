import { describe, expect, it } from "vitest";
import { isValidIban, maskIban, normalizeIban } from "./iban";

describe("iban", () => {
  it("accepts real example IBANs, with spaces and lower case", () => {
    expect(isValidIban("AE07 0331 2345 6789 0123 456")).toBe(true);
    expect(isValidIban("sa03 8000 0000 6080 1016 7519")).toBe(true);
    expect(isValidIban("GB82 WEST 1234 5698 7654 32")).toBe(true);
  });
  it("rejects a wrong check digit, wrong length and junk", () => {
    expect(isValidIban("AE08 0331 2345 6789 0123 456")).toBe(false);
    expect(isValidIban("AE07 0331 2345 6789 0123 45")).toBe(false);
    expect(isValidIban("hello")).toBe(false);
    expect(isValidIban("")).toBe(false);
  });
  it("normalises and masks", () => {
    expect(normalizeIban(" ae07-0331 ")).toBe("AE070331");
    expect(maskIban("AE07 0331 2345 6789 0123 456")).toBe("AE•• •••• 3456");
  });
});
