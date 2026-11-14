import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: h.findUnique } } }));

import { hasGuardianConsent } from "./live";

const ADULT = new Date("1990-01-01T00:00:00Z");
const MINOR = new Date("2020-01-01T00:00:00Z");

const student = (dateOfBirth: Date | null, verifiedAt?: Date | null) =>
  h.findUnique.mockResolvedValueOnce({ dateOfBirth, guardianConsent: verifiedAt === undefined ? null : { verifiedAt } });

beforeEach(() => h.findUnique.mockReset());

describe("hasGuardianConsent", () => {
  it("is false when the user does not exist", async () => {
    h.findUnique.mockResolvedValueOnce(null);
    expect(await hasGuardianConsent("nobody")).toBe(false);
  });

  it("treats a legacy account with no birth date as a minor: no verified row, no consent", async () => {
    student(null);
    expect(await hasGuardianConsent("legacy")).toBe(false);
  });

  it("needs no row for an adult", async () => {
    student(ADULT);
    expect(await hasGuardianConsent("adult")).toBe(true);
  });

  it("refuses a minor whose consent row is unverified", async () => {
    student(MINOR, null);
    expect(await hasGuardianConsent("minor")).toBe(false);
  });

  it("allows a minor once the consent row is verified", async () => {
    student(MINOR, new Date());
    expect(await hasGuardianConsent("minor")).toBe(true);
  });
});
