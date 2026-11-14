import { describe, expect, it } from "vitest";
import { payoutState } from "./payouts";

const s = (o: Partial<Parameters<typeof payoutState>[0]> = {}) => ({ instructorPayout: 7_000, status: "ACKNOWLEDGED" as const, paidAt: null, ...o });

describe("payoutState", () => {
  it("is ready only when acknowledged, positive and the teacher has bank details", () => {
    expect(payoutState(s(), true)).toBe("ready");
    expect(payoutState(s({ status: "OPEN" }), true)).toBe("needsAck");
    expect(payoutState(s(), false)).toBe("needsDetails");
  });
  it("never offers a paid, zero or negative statement", () => {
    expect(payoutState(s({ paidAt: new Date() }), true)).toBe("paid");
    expect(payoutState(s({ instructorPayout: 0 }), true)).toBe("nothing");
    expect(payoutState(s({ instructorPayout: -500 }), true)).toBe("nothing");
  });
});
