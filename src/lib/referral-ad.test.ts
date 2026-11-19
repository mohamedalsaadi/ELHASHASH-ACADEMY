import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { platformSetting: { findUnique } } }));

import { adRoles, getReferralAd, referralAdT, referralShareText } from "./referral-ad";
import { renderReferralAdEmail, referralAdSubject } from "./referral-ad-email";

beforeEach(() => findUnique.mockReset());

describe("getReferralAd", () => {
  it("is off until an admin switches it on", async () => {
    findUnique.mockResolvedValue({ referralPopupEnabled: false, referralRewardPercentOff: 5 });
    expect(await getReferralAd()).toEqual({ enabled: false, percent: 5 });
  });

  it("is on when switched on and the reward is above zero", async () => {
    findUnique.mockResolvedValue({ referralPopupEnabled: true, referralRewardPercentOff: 5 });
    expect(await getReferralAd()).toEqual({ enabled: true, percent: 5 });
  });

  it("stays off when the reward is zero, because the program is paused", async () => {
    findUnique.mockResolvedValue({ referralPopupEnabled: true, referralRewardPercentOff: 0 });
    expect((await getReferralAd()).enabled).toBe(false);
  });

  it("is off when no settings row exists", async () => {
    findUnique.mockResolvedValue(null);
    expect(await getReferralAd()).toEqual({ enabled: false, percent: 0 });
  });
});

describe("who sees the ad", () => {
  it("is for students, parents and visitors, never teachers or admins", () => {
    expect(adRoles("STUDENT")).toBe(true);
    expect(adRoles("PARENT")).toBe(true);
    expect(adRoles(undefined)).toBe(true);
    expect(adRoles("INSTRUCTOR")).toBe(false);
    expect(adRoles("ADMIN")).toBe(false);
  });
});

describe("copy", () => {
  it("puts the percent and the link into the words, in both languages", () => {
    expect(referralAdT("en")("title", { pct: 7 })).toContain("7%");
    expect(referralAdT("ar")("title", { pct: 7 })).toContain("7%");
    expect(referralShareText("en", "https://x.test/en/r/DHR1")).toContain("https://x.test/en/r/DHR1");
    expect(referralShareText("ar", "https://x.test/ar/r/DHR1")).toContain("https://x.test/ar/r/DHR1");
  });

  it("never promises the friend a reward, because the program gives the friend nothing", () => {
    for (const locale of ["ar", "en"] as const) {
      const t = referralAdT(locale);
      const all = ["title", "line", "rule1", "rule2", "rule3", "emailHow"].map((k) => t(k, { pct: 5 })).join(" ");
      expect(all).not.toMatch(/your friend (gets|receives)|صديقك (يحصل|يستلم)/i);
    }
  });
});

describe("renderReferralAdEmail", () => {
  it("starts right to left in Arabic and left to right in English, on the body and on the wrapper div", () => {
    const ar = renderReferralAdEmail("ar", { percent: 5 });
    const en = renderReferralAdEmail("en", { percent: 5 });
    expect(ar).toContain('<html dir="rtl"');
    expect(ar).toContain('<body dir="rtl"');
    expect(ar).toContain('<div dir="rtl" lang="ar" style="max-width:560px');
    expect(ar).toContain("text-align:right");
    expect(en).toContain('<html dir="ltr"');
    expect(en).toContain('<div dir="ltr" lang="en" style="max-width:560px');
    expect(en).toContain("text-align:left");
  });

  it("carries the percent, a sign-up button and the account link in the right language", () => {
    const html = renderReferralAdEmail("en", { percent: 5 });
    expect(html).toContain("5% off");
    expect(html).toContain("/en/signup");
    expect(html).toContain("/en/account");
    expect(renderReferralAdEmail("ar", { percent: 5 })).toContain("/ar/signup");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("{pct}");
  });

  it("adds the unsubscribe link only when one is given, and escapes it", () => {
    expect(renderReferralAdEmail("en", { percent: 5 })).not.toContain("Turn off optional emails");
    const html = renderReferralAdEmail("en", { percent: 5, unsubscribe: "https://x.test/u?a=1&b=2" });
    expect(html).toContain("Turn off optional emails");
    expect(html).toContain("a=1&amp;b=2");
  });

  it("has a subject with the percent", () => {
    expect(referralAdSubject("en", 5)).toContain("5%");
    expect(referralAdSubject("ar", 5)).toContain("5%");
  });
});
