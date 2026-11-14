import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ updateMany: vi.fn(async (_args: { where: Record<string, unknown>; data: Record<string, unknown> }) => ({ count: 1 })) }));
vi.mock("./db", () => ({ db: { user: { updateMany: h.updateMany } } }));

import { claimProvenPhone } from "./phone-proof";

beforeEach(() => {
  h.updateMany.mockClear();
  h.updateMany.mockResolvedValue({ count: 1 });
});

describe("claimProvenPhone", () => {
  it("leaves a verified number alone", async () => {
    expect(await claimProvenPhone({ id: "u1", phoneVerifiedAt: new Date("2026-01-01") })).toBe(false);
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it("verifies an unproven number and replaces the password so the old one and its sessions stop working", async () => {
    expect(await claimProvenPhone({ id: "u2", phoneVerifiedAt: null })).toBe(true);
    const arg = h.updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "u2", phoneVerifiedAt: null });
    expect(arg.data.phoneVerifiedAt).toBeInstanceOf(Date);
    expect(arg.data.passwordChangedAt).toBeInstanceOf(Date);
    expect(String(arg.data.passwordHash)).toMatch(/^\$2[aby]\$/);
  });

  it("does nothing twice when two codes race for the same row", async () => {
    h.updateMany.mockResolvedValue({ count: 0 });
    expect(await claimProvenPhone({ id: "u3", phoneVerifiedAt: null })).toBe(false);
  });
});
