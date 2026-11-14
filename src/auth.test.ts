import { beforeEach, describe, expect, it, vi } from "vitest";

// next-auth is replaced by a stub that hands back the config, so the callbacks and authorize functions can be called directly.
const h = vi.hoisted(() => ({
  cfg: null as null | {
    providers: { id?: string; authorize: (raw: unknown, req?: unknown) => Promise<Record<string, unknown> | null> }[];
    callbacks: {
      signIn: (a: { user: Record<string, unknown>; account?: { provider: string }; profile?: Record<string, unknown> }) => Promise<boolean>;
      jwt: (a: { token: Record<string, unknown>; user?: Record<string, unknown> }) => Promise<Record<string, unknown> | null>;
    };
  },
  db: {
    user: { findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    guardianConsent: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
  limited: vi.fn(),
  record: vi.fn(),
  findByPhone: vi.fn(),
  proof: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: (cfg: typeof h.cfg) => {
    h.cfg = cfg;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  },
}));
vi.mock("next-auth/providers/credentials", () => ({ default: (c: unknown) => c }));
vi.mock("next-auth/providers/google", () => ({ default: { id: "google" } }));
vi.mock("next-auth/providers/microsoft-entra-id", () => ({ default: { id: "microsoft-entra-id" } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/analytics", () => ({ logEvent: vi.fn(async () => {}) }));
vi.mock("@/lib/db", () => ({ db: h.db }));
vi.mock("@/lib/client-ip", () => ({ clientIp: () => "1.2.3.4" }));
vi.mock("@/lib/rate-limit", () => ({ isLimited: h.limited, recordAttempt: h.record }));
vi.mock("@/lib/user-phone", () => ({ findUserByPhone: h.findByPhone }));
vi.mock("@/lib/otp", () => ({ readProof: h.proof }));
// Real bcrypt at cost 12 is slow; a fake that keeps the compare contract is enough here.
vi.mock("bcryptjs", () => ({
  default: { hashSync: () => "no-account", hash: async () => "fresh-random-hash", compare: async (p: string, hash: string) => hash === `hash:${p}` },
}));

await import("./auth");
const cfg = () => h.cfg!;
const password = () => cfg().providers[0];
const otp = () => cfg().providers[1];

const student = { id: "u1", name: "Sara", role: "STUDENT", passwordHash: "hash:secret", passwordChangedAt: null, deletedAt: null };
const req = { headers: new Headers() };

beforeEach(() => {
  vi.clearAllMocks();
  h.limited.mockResolvedValue(false);
  h.db.$transaction.mockResolvedValue([]);
});

describe("password authorize", () => {
  const login = { login: "sara@example.com", password: "secret" };

  it("signs in a student with the right password", async () => {
    h.db.user.findUnique.mockResolvedValue(student);
    expect(await password().authorize(login, req)).toMatchObject({ id: "u1", role: "STUDENT", pwdAt: 0 });
  });

  it("records a failure for the account and the host on a wrong password", async () => {
    h.db.user.findUnique.mockResolvedValue(student);
    expect(await password().authorize({ ...login, password: "nope" }, req)).toBeNull();
    expect(h.record).toHaveBeenCalledWith("login:sara@example.com");
    expect(h.record).toHaveBeenCalledWith("login-ip:1.2.3.4");
  });

  it("refuses even the right password once the account has ten failures", async () => {
    h.db.user.findUnique.mockResolvedValue(student);
    h.limited.mockImplementation(async (key: string) => key.startsWith("login:"));
    expect(await password().authorize(login, req)).toBeNull();
  });

  it("refuses everything from a host over its cap", async () => {
    h.limited.mockImplementation(async (key: string) => key.startsWith("login-ip:"));
    expect(await password().authorize(login, req)).toBeNull();
    expect(h.db.user.findUnique).not.toHaveBeenCalled();
  });

  it("never signs in an erased account", async () => {
    h.db.user.findUnique.mockResolvedValue({ ...student, deletedAt: new Date() });
    expect(await password().authorize(login, req)).toBeNull();
  });
});

describe("otp authorize", () => {
  beforeEach(() => h.proof.mockReturnValue("+971501234567"));

  it("signs in a student and a parent by phone", async () => {
    for (const role of ["STUDENT", "PARENT"]) {
      h.db.user.findUnique.mockResolvedValue({ ...student, role });
      expect(await otp().authorize({ proof: "p" })).toMatchObject({ id: "u1", role });
    }
  });

  it("refuses staff, erased accounts and a bad proof", async () => {
    for (const role of ["INSTRUCTOR", "ADMIN"]) {
      h.db.user.findUnique.mockResolvedValue({ ...student, role });
      expect(await otp().authorize({ proof: "p" })).toBeNull();
    }
    h.db.user.findUnique.mockResolvedValue({ ...student, deletedAt: new Date() });
    expect(await otp().authorize({ proof: "p" })).toBeNull();
    h.proof.mockReturnValue(null);
    expect(await otp().authorize({ proof: "bad" })).toBeNull();
  });
});

describe("signIn callback", () => {
  const google = { provider: "google" };
  const run = (account: { provider: string }, profile: Record<string, unknown>, user: Record<string, unknown> = { email: "Sara@Example.com", name: "Sara" }) =>
    cfg().callbacks.signIn({ user, account, profile });

  it("lets credentials providers through untouched", async () => {
    expect(await run({ provider: "credentials" }, {})).toBe(true);
  });

  it("refuses Google when the address is not verified", async () => {
    expect(await run(google, { email_verified: false })).toBe(false);
    expect(h.db.user.findUnique).not.toHaveBeenCalled();
  });

  it("never lets Microsoft open an account that already exists", async () => {
    h.db.user.findUnique.mockResolvedValue({ id: "u1", role: "STUDENT", deletedAt: null, emailVerifiedAt: new Date(), passwordChangedAt: null });
    expect(await run({ provider: "microsoft-entra-id" }, {})).toBe(false);
  });

  it.each(["INSTRUCTOR", "ADMIN"])("keeps a %s off Google sign-in", async (role) => {
    h.db.user.findUnique.mockResolvedValue({ id: "u1", role, deletedAt: null, emailVerifiedAt: new Date(), passwordChangedAt: null });
    expect(await run(google, { email_verified: true })).toBe(false);
  });

  it("refuses an erased account", async () => {
    h.db.user.findUnique.mockResolvedValue({ id: "u1", role: "STUDENT", deletedAt: new Date(), emailVerifiedAt: new Date(), passwordChangedAt: null });
    expect(await run(google, { email_verified: true })).toBe(false);
  });

  it("creates a student row for a new Google address", async () => {
    h.db.user.findUnique.mockResolvedValue(null);
    h.db.user.upsert.mockResolvedValue({ id: "new", role: "STUDENT", passwordChangedAt: null });
    const user: Record<string, unknown> = { email: "New@Example.com", name: "New" };
    expect(await run(google, { email_verified: true }, user)).toBe(true);
    expect(h.db.user.upsert.mock.calls[0][0].create).toMatchObject({ email: "new@example.com", role: "STUDENT" });
    expect(user).toMatchObject({ id: "new", role: "STUDENT" });
  });

  it("opens a verified account without rewriting it", async () => {
    h.db.user.findUnique.mockResolvedValue({ id: "u1", role: "STUDENT", deletedAt: null, emailVerifiedAt: new Date(), passwordChangedAt: new Date(5000) });
    const user: Record<string, unknown> = { email: "sara@example.com" };
    expect(await run(google, { email_verified: true }, user)).toBe(true);
    expect(h.db.$transaction).not.toHaveBeenCalled();
    expect(user.pwdAt).toBe(5000);
  });

  it("strips a squatter's password, phone and guardian link when Google verifies a never-verified signup", async () => {
    h.db.user.findUnique.mockResolvedValue({ id: "u1", role: "STUDENT", deletedAt: null, emailVerifiedAt: null, passwordChangedAt: null });
    const user: Record<string, unknown> = { email: "sara@example.com" };
    expect(await run(google, { email_verified: true }, user)).toBe(true);
    expect(h.db.guardianConsent.deleteMany).toHaveBeenCalledWith({ where: { studentId: "u1" } });
    const data = h.db.user.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ passwordHash: "fresh-random-hash", phone: null });
    expect(data.passwordChangedAt).toBeInstanceOf(Date);
    expect(data.emailVerifiedAt).toBeInstanceOf(Date);
    // The owner's own token must match the new change time, or it would die at the next re-check.
    expect(user.pwdAt).toBe(data.passwordChangedAt.getTime());
  });
});

describe("jwt callback", () => {
  const jwt = (token: Record<string, unknown>, user?: Record<string, unknown>) => cfg().callbacks.jwt({ token, user });
  const old = () => Date.now() - 10 * 60_000;

  it("stamps a new token from the signed-in user", async () => {
    const t = await jwt({}, { id: "u1", role: "STUDENT", pwdAt: 7 });
    expect(t).toMatchObject({ sub: "u1", role: "STUDENT", pwdAt: 7 });
  });

  it("does not read the database inside the re-check window", async () => {
    const token = { sub: "u1", role: "STUDENT", pwdAt: 0, checkedAt: Date.now() };
    expect(await jwt(token)).toBe(token);
    expect(h.db.user.findUnique).not.toHaveBeenCalled();
  });

  it("ends the session when the row is gone, erased, or the password changed", async () => {
    const token = () => ({ sub: "u1", role: "STUDENT", pwdAt: 0, checkedAt: old() });
    h.db.user.findUnique.mockResolvedValueOnce(null);
    expect(await jwt(token())).toBeNull();
    h.db.user.findUnique.mockResolvedValueOnce({ role: "STUDENT", passwordChangedAt: null, deletedAt: new Date() });
    expect(await jwt(token())).toBeNull();
    h.db.user.findUnique.mockResolvedValueOnce({ role: "STUDENT", passwordChangedAt: new Date(9000), deletedAt: null });
    expect(await jwt(token())).toBeNull();
  });

  it("refreshes the role after the window", async () => {
    h.db.user.findUnique.mockResolvedValue({ role: "PARENT", passwordChangedAt: null, deletedAt: null });
    const t = await jwt({ sub: "u1", role: "STUDENT", pwdAt: 0, checkedAt: old() });
    expect(t).toMatchObject({ role: "PARENT" });
  });
});
