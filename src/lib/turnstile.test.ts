import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "./turnstile";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("verifyTurnstile", () => {
  it("lets everything through while the keys are not set", async () => {
    expect(await verifyTurnstile(null)).toBe(true);
  });

  it("needs a token once on, and trusts only Cloudflare's explicit answer", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    expect(await verifyTurnstile("")).toBe(false);

    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ success: false })));
    expect(await verifyTurnstile("t", "1.2.3.4")).toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ success: true })));
    expect(await verifyTurnstile("t")).toBe(true);
  });

  it("stays open when Cloudflare cannot be reached", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect(await verifyTurnstile("t")).toBe(true);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    expect(await verifyTurnstile("t")).toBe(true);
  });
});
