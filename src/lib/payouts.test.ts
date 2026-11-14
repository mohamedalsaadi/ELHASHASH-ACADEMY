import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ db: { teacherStatement: { findMany: vi.fn(), count: vi.fn(async (_args: { where: Record<string, unknown> }) => 2) } } }));
vi.mock("./db", () => ({ db: h.db }));

import { loadPayouts, payoutState, readyPayoutCount } from "./payouts";

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

describe("loadPayouts", () => {
  beforeEach(() => h.db.teacherStatement.findMany.mockReset());

  it("never caps the unpaid statements, so an old one cannot drop out; only the paid history is limited", async () => {
    const old = { id: "old", ...s(), instructor: { payoutIban: "AE07", payoutHolder: "Sayed" } };
    h.db.teacherStatement.findMany.mockResolvedValueOnce([old]).mockResolvedValueOnce([]);
    const rows = await loadPayouts();
    const [unpaid, paid] = h.db.teacherStatement.findMany.mock.calls.map((c) => c[0]);
    expect(unpaid.where).toEqual({ paidAt: null, instructorPayout: { gt: 0 } });
    expect(unpaid.take).toBeUndefined();
    expect(paid.take).toBe(20);
    expect(rows.map((r) => [r.id, r.state])).toEqual([["old", "ready"]]);
  });
});

describe("readyPayoutCount", () => {
  it("counts in SQL and treats an empty IBAN or holder as missing", async () => {
    expect(await readyPayoutCount()).toBe(2);
    const where = h.db.teacherStatement.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ paidAt: null, status: "ACKNOWLEDGED", instructorPayout: { gt: 0 } });
    expect(JSON.stringify(where.instructor)).toContain('"payoutIban":{"not":""}');
  });
});
