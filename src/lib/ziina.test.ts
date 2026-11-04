import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ziina.ts loads Prisma and the payment writer at import time; neither is under test here.
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("./payments", () => ({ applyPaymentOutcome: vi.fn(async () => true) }));

import { applyPaymentOutcome } from "./payments";
import { syncPaymentIntent } from "./ziina";

const apply = vi.mocked(applyPaymentOutcome);

const order = { id: "order-1", gatewayOrderId: "pi_1", total: 30000, vat: 0, currency: "AED" };

/** Ziina answers fetchIntent with this body. */
function ziinaSays(intent: Record<string, unknown>) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(intent), { status: 200 })));
}

beforeEach(() => {
  vi.stubEnv("ZIINA_API_KEY", "test-key");
  apply.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("syncPaymentIntent", () => {
  it("settles a completed intent for exactly the payable amount", async () => {
    ziinaSays({ id: "pi_1", status: "completed", amount: 30000, currency_code: "AED" });
    const result = await syncPaymentIntent(order);

    expect(result?.mismatch).toBe(false);
    expect(apply).toHaveBeenCalledWith(
      "order-1",
      "ziina:pi_1:completed",
      { kind: "paid", amount: 30000, currency: "AED" },
      expect.objectContaining({ id: "pi_1" }),
    );
  });

  it("counts VAT on top of the total when checking the amount", async () => {
    ziinaSays({ id: "pi_1", status: "completed", amount: 31500, currency_code: "AED" });
    expect((await syncPaymentIntent({ ...order, vat: 1500 }))?.mismatch).toBe(false);
    expect(apply).toHaveBeenCalled();
  });

  it("never settles a short or long amount, and says why", async () => {
    for (const amount of [29999, 30001]) {
      apply.mockClear();
      ziinaSays({ id: "pi_1", status: "completed", amount, currency_code: "AED" });
      expect((await syncPaymentIntent(order))?.mismatch).toBe(true);
      expect(apply).not.toHaveBeenCalled();
    }
  });

  it("never settles another currency", async () => {
    ziinaSays({ id: "pi_1", status: "completed", amount: 30000, currency_code: "USD" });
    expect((await syncPaymentIntent(order))?.mismatch).toBe(true);
    expect(apply).not.toHaveBeenCalled();
  });

  it("marks a failed intent failed and a canceled one expired", async () => {
    ziinaSays({ id: "pi_1", status: "failed", amount: 30000, currency_code: "AED" });
    await syncPaymentIntent(order);
    expect(apply).toHaveBeenCalledWith("order-1", "ziina:pi_1:failed", { kind: "failed" }, expect.anything());

    apply.mockClear();
    ziinaSays({ id: "pi_1", status: "canceled", amount: 30000, currency_code: "AED" });
    await syncPaymentIntent(order);
    expect(apply).toHaveBeenCalledWith("order-1", "ziina:pi_1:canceled", { kind: "expired" }, expect.anything());
  });

  it("records nothing while the intent is still open", async () => {
    ziinaSays({ id: "pi_1", status: "requires_payment", amount: 30000, currency_code: "AED" });
    await syncPaymentIntent(order);
    expect(apply).not.toHaveBeenCalled();
  });

  // The webhook and the result page both call this. A replay of the same delivery must hand the
  // writer the same event id, or it would be treated as a fresh event and grant twice.
  it("derives the same event id on every delivery of the same status", async () => {
    ziinaSays({ id: "pi_1", status: "completed", amount: 30000, currency_code: "AED" });
    await syncPaymentIntent(order);
    await syncPaymentIntent(order);
    await syncPaymentIntent(order);

    const ids = apply.mock.calls.map((call) => call[1]);
    expect(ids).toEqual(["ziina:pi_1:completed", "ziina:pi_1:completed", "ziina:pi_1:completed"]);
  });

  it("does nothing for an order with no intent yet", async () => {
    const fetched = vi.fn();
    vi.stubGlobal("fetch", fetched);
    expect(await syncPaymentIntent({ ...order, gatewayOrderId: null })).toBeNull();
    expect(fetched).not.toHaveBeenCalled();
  });
});
