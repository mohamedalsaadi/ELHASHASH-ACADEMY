import { beforeEach, describe, expect, it, vi } from "vitest";

const trx = vi.hoisted(() => ({
  teacherInvite: { findUnique: vi.fn(), updateMany: vi.fn() },
  user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  teacherSlot: { createMany: vi.fn() },
}));
const bcrypt = vi.hoisted(() => ({ compare: vi.fn(), hash: vi.fn() }));
const rate = vi.hoisted(() => ({ isLimited: vi.fn(), recordAttempt: vi.fn() }));

vi.mock("@/lib/db", () => ({ db: { $transaction: (fn: (t: typeof trx) => unknown) => fn(trx) } }));
vi.mock("bcryptjs", () => ({ default: bcrypt }));
vi.mock("@/lib/rate-limit", () => rate);
vi.mock("@/lib/analytics", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/client-ip", () => ({ clientIp: () => "1.2.3.4" }));
vi.mock("@/auth", () => ({ signIn: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "en" }));

import { acceptInvite } from "@/app/[locale]/invite/[token]/actions";

const form = (o: Record<string, string> = {}) => {
  const f = new FormData();
  for (const [k, v] of Object.entries({ token: "tok", password: "longenough1", confirm: "longenough1", ...o })) f.set(k, v);
  return f;
};
const open = { id: "i1", name: "T", email: "t@x.test", phone: null, usedAt: null, expiresAt: new Date(Date.now() + 1e6), slots: [{ gradeId: "g", subjectId: "s" }] };

beforeEach(() => {
  vi.clearAllMocks();
  rate.isLimited.mockResolvedValue(false);
  trx.teacherInvite.findUnique.mockResolvedValue(open);
  trx.teacherInvite.updateMany.mockResolvedValue({ count: 1 });
  trx.user.findUnique.mockResolvedValue(null);
  trx.user.create.mockResolvedValue({ id: "u1" });
  bcrypt.hash.mockResolvedValue("hash");
});

describe("acceptInvite", () => {
  it("rejects a used invite without creating an account", async () => {
    trx.teacherInvite.findUnique.mockResolvedValue({ ...open, usedAt: new Date() });
    expect(await acceptInvite(null, form())).toEqual({ error: "invalid" });
    expect(trx.user.create).not.toHaveBeenCalled();
  });

  it("rejects an expired invite", async () => {
    trx.teacherInvite.findUnique.mockResolvedValue({ ...open, expiresAt: new Date(Date.now() - 1) });
    expect(await acceptInvite(null, form())).toEqual({ error: "invalid" });
    expect(trx.user.create).not.toHaveBeenCalled();
  });

  it("loses the race cleanly when another request claimed the token first", async () => {
    trx.teacherInvite.updateMany.mockResolvedValue({ count: 0 });
    expect(await acceptInvite(null, form())).toEqual({ error: "invalid" });
    expect(trx.user.create).not.toHaveBeenCalled();
  });

  it("does not promote an existing account when the password is wrong", async () => {
    trx.user.findUnique.mockResolvedValue({ id: "u9", role: "STUDENT", passwordHash: "h", emailVerifiedAt: null });
    bcrypt.compare.mockResolvedValue(false);
    expect(await acceptInvite(null, form())).toEqual({ error: "password" });
    expect(trx.user.update).not.toHaveBeenCalled();
    expect(trx.teacherSlot.createMany).not.toHaveBeenCalled();
  });

  it("keeps an ADMIN as ADMIN but still grants the slots", async () => {
    trx.user.findUnique.mockResolvedValue({ id: "a1", role: "ADMIN", passwordHash: "h", emailVerifiedAt: null });
    bcrypt.compare.mockResolvedValue(true);
    await acceptInvite(null, form());
    expect(trx.user.update).not.toHaveBeenCalled();
    expect(trx.teacherSlot.createMany).toHaveBeenCalledWith({ data: [{ userId: "a1", gradeId: "g", subjectId: "s" }], skipDuplicates: true });
  });

  it("promotes a student who proves the password", async () => {
    trx.user.findUnique.mockResolvedValue({ id: "u9", role: "STUDENT", passwordHash: "h", emailVerifiedAt: null });
    bcrypt.compare.mockResolvedValue(true);
    await acceptInvite(null, form());
    expect(trx.user.update.mock.calls[0][0].data.role).toBe("INSTRUCTOR");
  });

  it("stops an address after too many attempts", async () => {
    rate.isLimited.mockResolvedValue(true);
    expect(await acceptInvite(null, form())).toEqual({ error: "too_many" });
    expect(trx.teacherInvite.findUnique).not.toHaveBeenCalled();
  });
});
