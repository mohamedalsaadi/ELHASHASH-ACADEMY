import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  teacherInvite: { create: vi.fn() },
}));
vi.mock("./db", () => ({ db }));

import { INVITE_TTL, inviteIsOpen, issueInvite } from "./invites";
import { hashToken } from "./token-utils";

beforeEach(() => vi.clearAllMocks());

describe("issueInvite", () => {
  it("stores only the token hash, expiring in seven days", async () => {
    db.teacherInvite.create.mockImplementation(async ({ data }: { data: unknown }) => data);
    const before = Date.now();
    const { raw, invite } = await issueInvite({ name: "T", email: "t@x.test", phone: null, slots: [], createdById: "admin" });
    const data = db.teacherInvite.create.mock.calls[0][0].data;
    expect(INVITE_TTL).toBe(7 * 86_400_000);
    expect(data.tokenHash).toBe(hashToken(raw));
    expect(JSON.stringify(data)).not.toContain(raw);
    expect(invite).toBe(data);
    expect(data.expiresAt.getTime()).toBeGreaterThanOrEqual(before + INVITE_TTL);
    expect(data.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + INVITE_TTL);
  });
});

describe("inviteIsOpen", () => {
  const now = new Date("2026-11-14T00:00:00Z");
  it("is closed at the exact expiry instant and once used", () => {
    expect(inviteIsOpen({ usedAt: null, expiresAt: new Date(now.getTime() + 1) }, now)).toBe(true);
    expect(inviteIsOpen({ usedAt: null, expiresAt: now }, now)).toBe(false);
    expect(inviteIsOpen({ usedAt: new Date(0), expiresAt: new Date(now.getTime() + 1e9) }, now)).toBe(false);
  });
});
