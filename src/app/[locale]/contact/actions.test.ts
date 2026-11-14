import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  create: vi.fn(),
  draftTicket: vi.fn(),
  verifyTurnstile: vi.fn(),
  isLimited: vi.fn(),
  sendMail: vi.fn(),
  after: [] as (() => Promise<void>)[],
}));

vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => void m.after.push(fn) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/db", () => ({ db: { supportTicket: { create: m.create } } }));
vi.mock("@/lib/client-ip", () => ({ clientIp: () => "1.2.3.4" }));
vi.mock("@/lib/mail", () => ({ emailLayout: () => "<p/>", sendMail: m.sendMail }));
vi.mock("@/lib/notify", () => ({ notifyAdmins: vi.fn(async () => undefined) }));
vi.mock("@/lib/rate-limit", () => ({ isLimited: m.isLimited, recordAttempt: vi.fn(async () => undefined) }));
vi.mock("@/lib/site", () => ({ CONTACT_EMAIL: "support@example.test" }));
vi.mock("@/lib/support", () => ({ draftTicket: m.draftTicket, mayDraft: (topic: string) => topic !== "privacy" }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: m.verifyTurnstile }));

import { sendSupportMessage } from "./actions";

function form(over: Record<string, string> = {}) {
  const f = new FormData();
  const fields = { name: "Sara", email: "sara@example.com", topic: "billing", message: "I was charged twice for the same course.", ...over };
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.after.length = 0;
  m.create.mockResolvedValue({ id: "t1" });
  m.draftTicket.mockResolvedValue("none");
  m.verifyTurnstile.mockResolvedValue(true);
  m.isLimited.mockResolvedValue(false);
  m.sendMail.mockResolvedValue(true);
});

const runAfter = () => Promise.all(m.after.map((fn) => fn()));

describe("sendSupportMessage", () => {
  it("answers ok to a honeypot hit without touching the database", async () => {
    expect(await sendSupportMessage(null, form({ website: "http://spam.test" }))).toBe("ok");
    expect(m.create).not.toHaveBeenCalled();
  });

  it("returns limited before any write when Turnstile fails", async () => {
    m.verifyTurnstile.mockResolvedValue(false);
    expect(await sendSupportMessage(null, form())).toBe("limited");
    expect(m.create).not.toHaveBeenCalled();
  });

  it("returns limited before any write when the rate limit is hit", async () => {
    m.isLimited.mockResolvedValue(true);
    expect(await sendSupportMessage(null, form())).toBe("limited");
    expect(m.create).not.toHaveBeenCalled();
  });

  it("returns unavailable when the ticket cannot be stored and the mail does not go", async () => {
    m.create.mockRejectedValue(new Error("db down"));
    m.sendMail.mockResolvedValue(false);
    expect(await sendSupportMessage(null, form())).toBe("unavailable");
  });

  it("never drafts a privacy ticket", async () => {
    expect(await sendSupportMessage(null, form({ topic: "privacy", message: "Please delete my child's data." }))).toBe("ok");
    await runAfter();
    expect(m.draftTicket).not.toHaveBeenCalled();
  });

  it("drafts a billing ticket", async () => {
    expect(await sendSupportMessage(null, form({ topic: "billing" }))).toBe("ok");
    await runAfter();
    expect(m.draftTicket).toHaveBeenCalledWith("t1");
  });
});
