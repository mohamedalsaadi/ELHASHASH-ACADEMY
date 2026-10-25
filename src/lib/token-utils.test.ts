import { describe, expect, it } from "vitest";
import { hashToken, newCode, newToken } from "./token-utils";

describe("tokens", () => {
  it("hashes deterministically and never returns the raw value", () => {
    const raw = "a-raw-token";
    expect(hashToken(raw)).toBe(hashToken(raw));
    expect(hashToken(raw)).not.toBe(raw);
    expect(hashToken(raw)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("creates distinct raw tokens", () => {
    expect(newToken()).not.toBe(newToken());
    expect(newToken().length).toBeGreaterThan(30);
  });

  it("creates six-digit codes, leading zeros included", () => {
    for (let i = 0; i < 100; i++) expect(newCode()).toMatch(/^\d{6}$/);
  });
});
