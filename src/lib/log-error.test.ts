import { describe, expect, it, vi } from "vitest";

const create = vi.fn().mockResolvedValue({});
vi.mock("@/lib/db", () => ({ db: { siteLog: { create: (a: unknown) => create(a), deleteMany: vi.fn() } } }));

import { describeError, logError, logWarn } from "./log-error";

describe("describeError", () => {
  it("reads the name, message and code of an error", () => {
    expect(describeError(Object.assign(new Error("boom"), { code: "P1001" }))).toEqual({ name: "Error", message: "boom", code: "P1001" });
  });
  it("copes with a thrown string", () => {
    expect(describeError("nope")).toEqual({ name: "Error", message: "nope", code: null });
  });
});

describe("logError", () => {
  it("writes an ERROR line with the context first and no stack", async () => {
    create.mockClear();
    await logError("payment.gateway", new Error("x".repeat(400)), { message: "intent create failed", meta: { orderId: "o1" } });
    const data = create.mock.calls[0][0].data;
    expect(data.level).toBe("ERROR");
    expect(data.source).toBe("payment.gateway");
    expect(data.message.startsWith("intent create failed: Error: ")).toBe(true);
    expect(data.message.length).toBeLessThan(220);
    expect(data.meta).toEqual({ orderId: "o1" });
  });
  it("drops a repeat inside the sample window", async () => {
    create.mockClear();
    await logWarn("ratelimit.test", "same line", { sample: 60_000 });
    await logWarn("ratelimit.test", "same line", { sample: 60_000 });
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("strips query strings from what it stores", async () => {
    create.mockClear();
    await logWarn("x.y", "GET /verify?token=secret failed");
    expect(create.mock.calls[0][0].data.message).toBe("GET /verify failed");
  });
});
