import { describe, expect, it } from "vitest";
import { CODE_RE, couponState, normalizeCode, type CouponRule } from "./coupons";

const now = new Date("2026-05-01T12:00:00Z");
const rule = (extra: Partial<CouponRule> = {}): CouponRule => ({
  active: true,
  startsAt: null,
  endsAt: null,
  maxRedemptions: null,
  perUser: 1,
  ...extra,
});

describe("couponState", () => {
  it("accepts an active code inside its window", () => {
    expect(couponState(rule(), 0, 0, now)).toBe("ok");
  });

  it("rejects an inactive code", () => {
    expect(couponState(rule({ active: false }), 0, 0, now)).toBe("invalid");
  });

  it("rejects before the start and from the end instant", () => {
    expect(couponState(rule({ startsAt: new Date("2026-05-02T00:00:00Z") }), 0, 0, now)).toBe("not_started");
    expect(couponState(rule({ endsAt: now }), 0, 0, now)).toBe("expired");
    expect(couponState(rule({ endsAt: new Date("2026-04-30T00:00:00Z") }), 0, 0, now)).toBe("expired");
  });

  it("enforces the total and per-user caps", () => {
    expect(couponState(rule({ maxRedemptions: 10 }), 9, 0, now)).toBe("ok");
    expect(couponState(rule({ maxRedemptions: 10 }), 10, 0, now)).toBe("used_up");
    expect(couponState(rule({ perUser: 2 }), 0, 1, now)).toBe("ok");
    expect(couponState(rule({ perUser: 2 }), 0, 2, now)).toBe("used_by_you");
  });
});

describe("codes", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeCode("  ramadan30 ")).toBe("RAMADAN30");
  });

  it("accepts letters, digits, dash and underscore only", () => {
    expect(CODE_RE.test("RAMADAN_30")).toBe(true);
    expect(CODE_RE.test("BACK-TO-SCHOOL")).toBe(true);
    expect(CODE_RE.test("bad code")).toBe(false);
    expect(CODE_RE.test("x")).toBe(false);
  });
});
