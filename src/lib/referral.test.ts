import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  referralCode: { findUnique: vi.fn() },
  platformSetting: { findUnique: vi.fn() },
  parentLink: { findMany: vi.fn() },
  referral: { findFirst: vi.fn() },
  order: { findFirst: vi.fn() },
}));

vi.mock("./db", () => ({ db }));
vi.mock("./coupon-resolve", () => ({ resolveCoupon: vi.fn() }));

import { resolveCoupon } from "./coupon-resolve";
import { newReferralCode, resolveDiscount } from "./referral";

const couponMiss = { ok: false as const, reason: "invalid" as const };
const referralCode = { id: "code-1", userId: "referrer-1", code: "DHRABCD1234", active: true };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveCoupon).mockResolvedValue(couponMiss);
  vi.mocked(db.platformSetting.findUnique).mockResolvedValue({ referralWelcomePercentOff: 10 } as never);
  vi.mocked(db.parentLink.findMany).mockResolvedValue([] as never);
  vi.mocked(db.referral.findFirst).mockResolvedValue(null);
  vi.mocked(db.order.findFirst).mockResolvedValue(null);
  vi.mocked(db.referralCode.findUnique).mockResolvedValue(referralCode as never);
});

describe("newReferralCode", () => {
  it("is a coupon-valid, uppercase code", () => {
    const code = newReferralCode();
    expect(code).toMatch(/^DHR[0-9A-F]{8}$/);
  });
});

describe("resolveDiscount", () => {
  it("returns an ordinary coupon without touching the referral tables", async () => {
    const coupon = { id: "c1", code: "SAVE10", funding: "STANDARD", ownerId: null };
    vi.mocked(resolveCoupon).mockResolvedValue({ ok: true, coupon } as never);
    const r = await resolveDiscount("SAVE10", "buyer-1");
    expect(r).toEqual({ ok: true, kind: "coupon", coupon, funding: "STANDARD" });
    expect(db.referralCode.findUnique).not.toHaveBeenCalled();
  });

  it("does not fall through to a referral when a coupon matched but expired", async () => {
    vi.mocked(resolveCoupon).mockResolvedValue({ ok: false, reason: "expired" });
    const r = await resolveDiscount("SAVE10", "buyer-1");
    expect(r).toEqual({ ok: false, reason: "expired" });
  });

  it("accepts a referral code for a first-purchase family", async () => {
    const r = await resolveDiscount("dhr-abcd-1234", "buyer-1");
    expect(r).toMatchObject({ ok: true, kind: "referral", referrerId: "referrer-1", percentOff: 10 });
  });

  it("refuses the referrer's own family", async () => {
    vi.mocked(db.parentLink.findMany)
      .mockResolvedValueOnce([{ studentId: "referrer-1" }] as never)
      .mockResolvedValueOnce([] as never);
    const r = await resolveDiscount("DHRABCD1234", "buyer-1");
    expect(r).toEqual({ ok: false, reason: "referral_self" });
  });

  it("refuses a family that already used a referral", async () => {
    vi.mocked(db.referral.findFirst).mockResolvedValue({ id: "r1" } as never);
    const r = await resolveDiscount("DHRABCD1234", "buyer-1");
    expect(r).toEqual({ ok: false, reason: "referral_used" });
  });

  it("refuses a family that has already paid", async () => {
    vi.mocked(db.order.findFirst).mockResolvedValue({ id: "o1" } as never);
    const r = await resolveDiscount("DHRABCD1234", "buyer-1");
    expect(r).toEqual({ ok: false, reason: "referral_not_first" });
  });

  it("refuses referrals when the owner has switched them off", async () => {
    vi.mocked(db.platformSetting.findUnique).mockResolvedValue({ referralWelcomePercentOff: 0 } as never);
    const r = await resolveDiscount("DHRABCD1234", "buyer-1");
    expect(r).toEqual({ ok: false, reason: "referral_unavailable" });
  });

  it("refuses an unknown code", async () => {
    vi.mocked(db.referralCode.findUnique).mockResolvedValue(null);
    const r = await resolveDiscount("DHRZZZZZZZZ", "buyer-1");
    expect(r).toEqual({ ok: false, reason: "invalid" });
  });
});
