import { afterEach, describe, expect, it, vi } from "vitest";
import { courseZone, formatMoney as format, minorPerUnit, toMinor } from "./format";
import { activeGateway, canCharge, chargeableCurrencies, stripeUnitAmount } from "./gateway";
import { price } from "./pricing-engine";

// Intl separates the code from the amount with a no-break space.
const formatMoney = (...a: Parameters<typeof format>) => format(...a).replace(/ /g, " ");

describe("minor units", () => {
  it("uses fils (1/1000) for KWD, BHD and OMR and 1/100 for the rest", () => {
    for (const c of ["KWD", "BHD", "OMR"] as const) expect(minorPerUnit(c)).toBe(1000);
    for (const c of ["EGP", "SAR", "AED", "QAR"] as const) expect(minorPerUnit(c)).toBe(100);
  });

  it("formats 12.500 KWD with three decimals", () => {
    expect(formatMoney(12500, "KWD", "en")).toBe("KWD 12.500");
    expect(formatMoney(12000, "KWD", "en")).toBe("KWD 12");
    expect(formatMoney(30000, "AED", "en")).toBe("AED 300");
    expect(formatMoney(30050, "EGP", "en")).toBe("EGP 300.50");
  });

  it("reads admin input in major units, keeping 3-decimal amounts on a multiple of 10 fils", () => {
    expect(toMinor(12.5, "KWD")).toBe(12500);
    expect(toMinor(12.505, "KWD") % 10).toBe(0);
    expect(toMinor(300.5, "EGP")).toBe(30050);
  });
});

describe("Stripe amounts", () => {
  it("accepts a multiple of 10 fils and rejects anything else", () => {
    expect(stripeUnitAmount(12500, "KWD")).toBe(12500);
    expect(() => stripeUnitAmount(12505, "KWD")).toThrow();
    expect(stripeUnitAmount(12505, "AED")).toBe(12505);
  });

  it("keeps a bundle discount on a multiple of 10 fils", () => {
    const line = (subjectId: string, amount: number) => ({
      skuId: subjectId, courseId: subjectId, subjectId, accessType: "SEMESTER" as const, price: amount, currency: "KWD" as const,
    });
    const r = price([line("math", 12340), line("physics", 9990)], [{ id: "mp", subjectIds: ["math", "physics"], percentOff: 15 }], new Date());
    for (const l of r.lines) expect((l.price - l.discount) % 10).toBe(0);
  });
});

describe("gateway", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("pays AED through Ziina and keeps Stripe and Paymob hidden", () => {
    vi.stubEnv("ZIINA_API_KEY", "test");
    vi.stubEnv("PAYMOB_SECRET_KEY", "test");
    vi.stubEnv("STRIPE_ENABLED", "");
    vi.stubEnv("PAYMOB_ENABLED", "");
    expect(activeGateway("AED")).toEqual({ gateway: "ZIINA", methods: ["CARD"] });
    expect(activeGateway("EGP")).toBeNull();
    expect(activeGateway("KWD")).toBeNull();
  });

  it("offers nothing when Ziina is switched off and Stripe is hidden", () => {
    vi.stubEnv("ZIINA_API_KEY", "test");
    vi.stubEnv("ZIINA_ENABLED", "0");
    vi.stubEnv("STRIPE_ENABLED", "");
    expect(activeGateway("AED")).toBeNull();
  });

  it("brings Stripe and Paymob back only when the owner turns them on", () => {
    vi.stubEnv("ZIINA_API_KEY", "");
    vi.stubEnv("PAYMOB_SECRET_KEY", "test");
    vi.stubEnv("PAYMOB_ENABLED", "1");
    vi.stubEnv("STRIPE_ENABLED", "1");
    vi.stubEnv("STRIPE_CURRENCIES", "AED,SAR");
    expect(activeGateway("EGP")?.gateway).toBe("PAYMOB");
    expect(activeGateway("AED")?.gateway).toBe("STRIPE");
    expect(activeGateway("SAR")?.gateway).toBe("STRIPE");
    expect(activeGateway("KWD")).toBeNull();
  });

  it("never lets Stripe take a currency the owner did not list", () => {
    vi.stubEnv("ZIINA_API_KEY", "");
    vi.stubEnv("STRIPE_ENABLED", "1");
    vi.stubEnv("STRIPE_CURRENCIES", "");
    expect(activeGateway("AED")).toBeNull();
    expect(activeGateway("KWD")).toBeNull();
  });

  it("reports which prices can be paid today", () => {
    vi.stubEnv("ZIINA_API_KEY", "test");
    vi.stubEnv("ZIINA_ENABLED", "1");
    vi.stubEnv("STRIPE_ENABLED", "");
    expect(canCharge("AED")).toBe(true);
    expect(canCharge("SAR")).toBe(false);
    expect(chargeableCurrencies()).toEqual(["AED"]);
  });

  it("never selects Ziina when the test flag is set on a production deployment", () => {
    vi.stubEnv("ZIINA_API_KEY", "test");
    vi.stubEnv("ZIINA_TEST", "1");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("STRIPE_ENABLED", "");
    expect(activeGateway("AED")).toBeNull();
  });

  it("allows Ziina test mode off production", () => {
    vi.stubEnv("ZIINA_API_KEY", "test");
    vi.stubEnv("ZIINA_TEST", "1");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(activeGateway("AED")?.gateway).toBe("ZIINA");
  });
});

describe("courseZone", () => {
  it("schedules live lectures in the course country's time, skill courses in UAE time", () => {
    const zone = (timeZone: string) => courseZone({ grade: { country: { timeZone } } });
    expect(zone("Asia/Dubai")).toBe("Asia/Dubai");
    expect(zone("Africa/Cairo")).toBe("Africa/Cairo");
    expect(zone("Asia/Kuwait")).toBe("Asia/Kuwait");
    expect(zone("Asia/Muscat")).toBe("Asia/Muscat");
    expect(courseZone({ grade: null })).toBe("Asia/Dubai");
  });
});
