import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  signOut: vi.fn(),
  db: { user: { findUniqueOrThrow: vi.fn(), update: vi.fn() } },
  erase: vi.fn(),
  limited: vi.fn(),
  record: vi.fn(),
  checkOtp: vi.fn(),
  issueOtp: vi.fn(),
  send: vi.fn(),
  whatsapp: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: h.auth, signOut: h.signOut }));
vi.mock("@/generated/prisma/client", () => ({ Prisma: { PrismaClientKnownRequestError: class extends Error {} } }));
vi.mock("@/lib/db", () => ({ db: h.db }));
vi.mock("@/lib/erasure", () => ({ eraseAccount: h.erase }));
vi.mock("@/lib/rate-limit", () => ({ isLimited: h.limited, recordAttempt: h.record }));
vi.mock("@/lib/otp", () => ({ checkOtp: h.checkOtp, issueOtp: h.issueOtp }));
vi.mock("@/lib/whatsapp", () => ({ sendWhatsAppCode: h.send, whatsappEnabled: h.whatsapp }));
vi.mock("@/lib/client-ip", () => ({ clientIp: () => "1.2.3.4" }));
vi.mock("@/lib/mail", () => ({ appUrl: () => "", emailLayout: () => "", sendMail: vi.fn() }));
vi.mock("@/lib/tokens", () => ({ issueToken: vi.fn(), VERIFY_TTL: 1 }));
vi.mock("@/lib/token-utils", () => ({ newCode: () => "123456", hashToken: (s: string) => s }));
vi.mock("@/lib/contact-guard", () => ({ maskContacts: (s: string) => ({ text: s }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next-intl/server", () => ({ getLocale: async () => "ar" }));
// A phone or Google account holds the hash of a random string nobody knows; only "hash:<typed>" compares equal.
vi.mock("bcryptjs", () => ({ default: { hash: async (p: string) => `hash:${p}`, compare: async (p: string, hash: string) => hash === `hash:${p}` } }));

import { changeOwnPassword, deleteAccount, sendAccountCode } from "./actions";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const phoneOnly = { passwordHash: "hash:never-known-uuid", phone: "+971501234567", locale: "ar" };

beforeEach(() => {
  vi.clearAllMocks();
  h.limited.mockResolvedValue(false);
  h.whatsapp.mockReturnValue(true);
  h.auth.mockResolvedValue({ user: { id: "u1", name: "Sara", role: "STUDENT" } });
  h.db.user.findUniqueOrThrow.mockResolvedValue(phoneOnly);
});

describe("deleteAccount", () => {
  it("erases a phone-only account on a fresh code, with no password", async () => {
    h.checkOtp.mockResolvedValue(true);
    expect(await deleteAccount(null, form({ password: "", code: "123456" }))).toBe("ok");
    expect(h.checkOtp).toHaveBeenCalledWith("+971501234567", "123456");
    expect(h.erase).toHaveBeenCalledWith("u1");
  });

  it("refuses a wrong code and deletes nothing", async () => {
    h.checkOtp.mockResolvedValue(false);
    expect(await deleteAccount(null, form({ password: "", code: "000000" }))).toBe("wrong");
    expect(h.erase).not.toHaveBeenCalled();
    expect(h.record).toHaveBeenCalledWith("delete:u1");
  });

  it("still works with the password", async () => {
    h.db.user.findUniqueOrThrow.mockResolvedValue({ ...phoneOnly, passwordHash: "hash:secret" });
    expect(await deleteAccount(null, form({ password: "secret" }))).toBe("ok");
    expect(h.erase).toHaveBeenCalledWith("u1");
    expect(h.checkOtp).not.toHaveBeenCalled();
  });

  it("refuses a wrong password, and the random hash cannot be matched by a guess", async () => {
    expect(await deleteAccount(null, form({ password: "guess" }))).toBe("wrong");
    expect(h.erase).not.toHaveBeenCalled();
  });

  it("refuses a code when the account has no phone", async () => {
    h.db.user.findUniqueOrThrow.mockResolvedValue({ ...phoneOnly, phone: null });
    expect(await deleteAccount(null, form({ code: "123456" }))).toBe("wrong");
    expect(h.checkOtp).not.toHaveBeenCalled();
  });

  it("keeps staff on passwords and out of self-erasure", async () => {
    h.auth.mockResolvedValue({ user: { id: "t1", name: "T", role: "INSTRUCTOR" } });
    expect(await deleteAccount(null, form({ code: "123456" }))).toBe("denied");
    expect(h.erase).not.toHaveBeenCalled();
  });
});

describe("changeOwnPassword", () => {
  it("sets a first password on a fresh code", async () => {
    h.checkOtp.mockResolvedValue(true);
    expect(await changeOwnPassword(null, form({ current: "", code: "123456", next: "brand-new-pass" }))).toBe("ok");
    expect(h.db.user.update.mock.calls[0][0].data.passwordHash).toBe("hash:brand-new-pass");
  });

  it("refuses a wrong code", async () => {
    h.checkOtp.mockResolvedValue(false);
    expect(await changeOwnPassword(null, form({ current: "", code: "000000", next: "brand-new-pass" }))).toBe("wrong");
    expect(h.db.user.update).not.toHaveBeenCalled();
  });

  it("does not let a staff account swap the code for the password", async () => {
    h.auth.mockResolvedValue({ user: { id: "t1", name: "T", role: "ADMIN" } });
    h.checkOtp.mockResolvedValue(true);
    expect(await changeOwnPassword(null, form({ current: "", code: "123456", next: "brand-new-pass" }))).toBe("wrong");
    expect(h.db.user.update).not.toHaveBeenCalled();
  });
});

describe("sendAccountCode", () => {
  it("sends a code to the account's own number and returns it masked", async () => {
    h.issueOtp.mockResolvedValue("123456");
    h.send.mockResolvedValue(true);
    const out = await sendAccountCode();
    expect(h.send).toHaveBeenCalledWith("+971501234567", "123456", "ar");
    expect(out).toEqual({ ok: true, phone: "+971...567" });
  });

  it("stops at the rate limit before issuing a code", async () => {
    h.limited.mockResolvedValue(true);
    expect(await sendAccountCode()).toEqual({ ok: false, error: "too_many" });
    expect(h.issueOtp).not.toHaveBeenCalled();
  });

  it("sends nothing to staff or to an account without an international number", async () => {
    h.auth.mockResolvedValue({ user: { id: "t1", name: "T", role: "INSTRUCTOR" } });
    expect(await sendAccountCode()).toEqual({ ok: false, error: "send_failed" });
    h.auth.mockResolvedValue({ user: { id: "u1", name: "Sara", role: "STUDENT" } });
    h.db.user.findUniqueOrThrow.mockResolvedValue({ ...phoneOnly, phone: "0501234567" });
    expect(await sendAccountCode()).toEqual({ ok: false, error: "send_failed" });
    expect(h.send).not.toHaveBeenCalled();
  });
});
