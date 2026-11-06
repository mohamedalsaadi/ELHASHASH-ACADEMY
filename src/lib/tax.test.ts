import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ country: { findUnique: vi.fn() } }));
const finance = vi.hoisted(() => ({ getFinanceConfig: vi.fn() }));

vi.mock("./db", () => ({ db }));
vi.mock("./platform-settings", () => ({ getFinanceConfig: finance.getFinanceConfig }));

import { taxConfigFor, vatFor } from "./tax";

beforeEach(() => {
  vi.clearAllMocks();
  finance.getFinanceConfig.mockResolvedValue({
    vatEnabled: false,
    vatRateBp: 500,
    vatTrn: null,
    platformShareBp: 3000,
    referralWelcomePercentOff: 0,
    referralRewardPercentOff: 0,
    corporateTaxEnabled: false,
    corporateTaxBp: 900,
    sellerLegalName: null,
    sellerAddress: null,
    sellerLicenceNo: null,
  });
});

describe("vatFor", () => {
  it("is zero when the market is off", () => {
    expect(vatFor(10_000, { vatEnabled: false, vatRateBp: 500, vatTrn: null, taxCountryCode: "AE" })).toBe(0);
  });

  it("rounds to the nearest minor unit at the market rate", () => {
    expect(vatFor(10_000, { vatEnabled: true, vatRateBp: 500, vatTrn: "TRN", taxCountryCode: "AE" })).toBe(500);
    expect(vatFor(100, { vatEnabled: true, vatRateBp: 1500, vatTrn: "TRN", taxCountryCode: "SA" })).toBe(15);
  });
});

describe("taxConfigFor", () => {
  it("charges nothing while the master switch is off", async () => {
    const tax = await taxConfigFor("AE");
    expect(tax).toMatchObject({ vatEnabled: false, vatRateBp: 0 });
    expect(db.country.findUnique).not.toHaveBeenCalled();
  });

  it("charges a registered market at its own rate", async () => {
    finance.getFinanceConfig.mockResolvedValue({
      ...(await finance.getFinanceConfig()),
      vatEnabled: true,
      vatRateBp: 500,
      vatTrn: "GLOBAL",
    });
    db.country.findUnique.mockResolvedValue({ vatEnabled: true, vatRateBp: 500, vatTrn: "AE-TRN" });
    expect(await taxConfigFor("AE")).toEqual({ vatEnabled: true, vatRateBp: 500, vatTrn: "AE-TRN", taxCountryCode: "AE" });
  });

  it("does not charge an unregistered market even when the master is on", async () => {
    finance.getFinanceConfig.mockResolvedValue({
      ...(await finance.getFinanceConfig()),
      vatEnabled: true,
      vatRateBp: 500,
      vatTrn: "GLOBAL",
    });
    db.country.findUnique.mockResolvedValue({ vatEnabled: false, vatRateBp: 1400, vatTrn: null });
    expect(await taxConfigFor("EG")).toMatchObject({ vatEnabled: false, vatRateBp: 0 });
  });

  it("uses the global profile for a skill course with no country", async () => {
    finance.getFinanceConfig.mockResolvedValue({
      ...(await finance.getFinanceConfig()),
      vatEnabled: true,
      vatRateBp: 500,
      vatTrn: "GLOBAL",
    });
    expect(await taxConfigFor(null)).toMatchObject({ vatEnabled: true, vatRateBp: 500, vatTrn: "GLOBAL" });
  });
});
