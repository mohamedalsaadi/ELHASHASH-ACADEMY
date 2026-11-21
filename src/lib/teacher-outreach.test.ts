import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, { email: string }>();
vi.mock("@/lib/db", () => ({
  db: {
    teacherOutreach: {
      findMany: vi.fn(async ({ where }: { where: { email: { in: string[] } } }) => where.email.in.filter((e) => store.has(e)).map((email) => ({ email }))),
      create: vi.fn(async ({ data }: { data: { email: string } }) => void store.set(data.email, data)),
    },
  },
}));
vi.mock("@/lib/platform-settings", () => ({ getFinanceConfig: vi.fn(async () => ({ platformShareBp: 3000 })) }));
vi.mock("@/lib/mail", () => ({ appUrl: () => "https://dhirwa.ae", esc: (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"), sendMailDetailed: vi.fn() }));

import { sendMailDetailed } from "@/lib/mail";
import { MAX_PER_SEND, parseEmails, sendTeacherInvites } from "./teacher-outreach";
import { renderTeacherInviteEmail, teacherSharePercent } from "./teacher-invite-email";

const send = vi.mocked(sendMailDetailed);

beforeEach(() => {
  store.clear();
  send.mockReset();
  send.mockResolvedValue({ ok: true, detail: "id" });
});

describe("parseEmails", () => {
  it("splits on spaces, commas, semicolons and lines, lowercases and drops repeats", () => {
    const r = parseEmails("A@x.com, b@x.com;\nA@X.com  c@x.com");
    expect(r.valid).toEqual(["a@x.com", "b@x.com", "c@x.com"]);
    expect(r.invalid).toEqual([]);
  });
  it("sets aside what is not an address", () => {
    const r = parseEmails("good@x.com not-an-email @x.com");
    expect(r.valid).toEqual(["good@x.com"]);
    expect(r.invalid).toEqual(["not-an-email", "@x.com"]);
  });
});

describe("sendTeacherInvites", () => {
  it("mails each new address once and records it", async () => {
    const r = await sendTeacherInvites({ text: "a@x.com b@x.com", locale: "ar", adminId: "admin", replyTo: "me@dhirwa.ae" });
    expect(r).toMatchObject({ sent: 2, already: 0, failed: 0, invalid: 0 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0]).toMatchObject({ to: "a@x.com", replyTo: "me@dhirwa.ae" });
    expect(store.has("a@x.com")).toBe(true);
  });

  it("never mails an address twice", async () => {
    await sendTeacherInvites({ text: "a@x.com", locale: "ar", adminId: "admin" });
    send.mockClear();
    const r = await sendTeacherInvites({ text: "a@x.com b@x.com", locale: "en", adminId: "admin" });
    expect(r).toMatchObject({ sent: 1, already: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toBe("b@x.com");
  });

  it("does not record an address the mail provider refused", async () => {
    send.mockResolvedValue({ ok: false, detail: "403 domain not verified" });
    const r = await sendTeacherInvites({ text: "a@x.com", locale: "ar", adminId: "admin" });
    expect(r).toMatchObject({ sent: 0, failed: 1, detail: "403 domain not verified" });
    expect(store.size).toBe(0);
  });

  it("leaves out addresses past the limit and says so", async () => {
    const text = Array.from({ length: MAX_PER_SEND + 3 }, (_, i) => `t${i}@x.com`).join(" ");
    const r = await sendTeacherInvites({ text, locale: "ar", adminId: "admin" });
    expect(r.sent).toBe(MAX_PER_SEND);
    expect(r.tooMany).toBe(3);
  });
});

describe("renderTeacherInviteEmail", () => {
  it("states the teacher share from the platform share and sets direction on the wrapper", () => {
    expect(teacherSharePercent(3000)).toBe(70);
    const ar = renderTeacherInviteEmail("ar", { sharePercent: 70 });
    expect(ar).toContain('dir="rtl"');
    expect(ar).toContain('<span dir="ltr">70%</span>');
    expect(ar).toContain("https://dhirwa.ae/ar/teach");
    expect(ar).not.toContain("undefined");
    const en = renderTeacherInviteEmail("en", { sharePercent: 65 });
    expect(en).toContain("65%");
    expect(en).toContain("195 AED");
    expect(en).toContain("https://dhirwa.ae/en/teach");
  });
});
