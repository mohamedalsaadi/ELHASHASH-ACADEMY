import { beforeAll, describe, expect, it } from "vitest";
import { isOptionalKind, unsubscribeSig, unsubscribeUrl, verifyUnsubscribe } from "./unsubscribe";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-unsubscribe";
});

describe("unsubscribe link", () => {
  it("verifies the signature it made for the same user", () => {
    expect(verifyUnsubscribe("user-1", unsubscribeSig("user-1"))).toBe(true);
  });

  it("refuses another user's id, a changed signature and an empty one", () => {
    const sig = unsubscribeSig("user-1");
    expect(verifyUnsubscribe("user-2", sig)).toBe(false);
    expect(verifyUnsubscribe("user-1", sig.slice(0, -2) + "xx")).toBe(false);
    expect(verifyUnsubscribe("user-1", "")).toBe(false);
  });

  it("builds an address on the given base with both parts", () => {
    const url = new URL(unsubscribeUrl("https://dhirwa.ae", "user 1"));
    expect(url.origin + url.pathname).toBe("https://dhirwa.ae/api/unsubscribe");
    expect(url.searchParams.get("u")).toBe("user 1");
    expect(url.searchParams.get("s")).toBe(unsubscribeSig("user 1"));
  });

  it("never switches off receipts or system mail", () => {
    expect(isOptionalKind("ORDER_PAID")).toBe(false);
    expect(isOptionalKind("SYSTEM")).toBe(false);
    expect(isOptionalKind("ANSWER")).toBe(true);
    expect(isOptionalKind("LIVE_SOON")).toBe(true);
  });
});
