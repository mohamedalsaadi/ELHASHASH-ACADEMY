import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inviteWhatsAppEnabled, sendWhatsAppInvite } from "./whatsapp";

const env = { WHATSAPP_PHONE_NUMBER_ID: "123", WHATSAPP_ACCESS_TOKEN: "tok", WHATSAPP_INVITE_TEMPLATE: "dhirwa_course_invite" };

describe("sendWhatsAppInvite", () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is off until the invite template is named", () => {
    vi.stubEnv("WHATSAPP_INVITE_TEMPLATE", "");
    expect(inviteWhatsAppEnabled()).toBe(false);
  });

  it("sends nothing when off", async () => {
    vi.stubEnv("WHATSAPP_INVITE_TEMPLATE", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await sendWhatsAppInvite("+971501234567", "Math", "math", "en")).ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the template with the title and slug", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const r = await sendWhatsAppInvite("+971 50 123 4567", "Advanced\nMath", "math-12", "ar");
    expect(r.ok).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.to).toBe("971501234567");
    expect(body.template.name).toBe("dhirwa_course_invite");
    expect(body.template.language.code).toBe("ar");
    expect(body.template.components[0].parameters[0].text).toBe("Advanced Math");
    expect(body.template.components[1].parameters[0].text).toBe("math-12");
  });

  it("reports a refusal", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => '{"error":{"code":132001}}' }));
    const r = await sendWhatsAppInvite("+971501234567", "Math", "math", "en");
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("132001");
  });
});
