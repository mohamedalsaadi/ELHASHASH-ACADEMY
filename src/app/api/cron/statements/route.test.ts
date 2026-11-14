import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A loose row type on purpose: the in-memory db below reads whatever fields the route filters on.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

// An in-memory stand-in for the three queries the route makes, honouring the `lt` / `lte` cut-off it is given.
const h = vi.hoisted(() => {
  const state = { ledger: [] as Row[], statements: [] as Row[], notified: 0 };
  const db = {
    ledgerEntry: {
      findMany: async ({ where }: Row) =>
        state.ledger.filter((r) => r.instructorId && (where.createdAt.lt ? r.createdAt < where.createdAt.lt : r.createdAt <= where.createdAt.lte)),
    },
    teacherStatement: {
      findMany: async ({ where }: Row) => state.statements.filter((s) => s.period < where.period.lt).sort((a, b) => (a.period < b.period ? 1 : -1)),
      findUnique: async ({ where }: Row) => {
        const k = where.instructorId_period_currency;
        return state.statements.find((s) => s.instructorId === k.instructorId && s.period === k.period && s.currency === k.currency) ?? null;
      },
      create: async ({ data }: Row) => void state.statements.push({ id: `s${state.statements.length}`, status: "OPEN", ...data }),
      update: async ({ where, data }: Row) => void Object.assign(state.statements.find((s) => s.id === where.id)!, data),
    },
  };
  return { state, db };
});
vi.mock("@/lib/db", () => ({ db: h.db }));
vi.mock("@/lib/notify", () => ({ createNotification: vi.fn(async () => void h.state.notified++) }));

import { GET } from "./route";

const call = (auth?: string) => GET(new Request("http://x/api/cron/statements", { headers: auth ? { authorization: auth } : {} }));
const entry = (instructorId: string, currency: string, at: string, p: number, extra: Row = {}) => ({
  createdAt: new Date(at), currency, instructorId, gross: p, vat: 0, net: p, platformFee: 0, platformDiscount: 0, corporateTax: 0, instructorNet: p, instructorPayout: p, ...extra,
});
const stmt = (instructorId: string, currency: string) => h.state.statements.find((s) => s.instructorId === instructorId && s.currency === currency && s.period === "2026-10");

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "e2e-cron");
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T02:00:00Z")); // cut-off: 2026-10-18T00:00:00Z
  h.state.statements = [];
  h.state.notified = 0;
  h.state.ledger = [
    entry("a", "AED", "2026-10-02T10:00:00Z", 10_000),
    entry("a", "AED", "2026-10-17T23:59:59Z", 5_000),
    entry("a", "AED", "2026-10-01T10:00:00Z", -2_000, { gross: -2_000, net: -2_000 }), // a refund nets in
    entry("a", "AED", "2026-10-18T00:00:00Z", 9_999), // exactly the cut-off: waits for the next statement
    entry("a", "AED", "2026-10-25T10:00:00Z", 9_999), // younger than the refund hold
    entry("a", "KWD", "2026-10-05T10:00:00Z", 3_000),
    entry("b", "AED", "2026-09-20T10:00:00Z", 4_000),
  ];
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("GET /api/cron/statements", () => {
  it("refuses a missing or wrong secret", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer nope")).status).toBe(401);
    expect(h.state.statements).toHaveLength(0);
  });

  it("writes one statement per teacher and currency covering only sales older than the cut-off", async () => {
    const res = await call("Bearer e2e-cron");
    expect(await res.json()).toMatchObject({ ok: true, period: "2026-10", created: 3, statements: 3 });
    expect(stmt("a", "AED")).toMatchObject({ instructorPayout: 13_000, salesCount: 2, refundCount: 1, coversTo: new Date("2026-10-18T00:00:00Z") });
    expect(stmt("a", "KWD")?.instructorPayout).toBe(3_000);
    expect(stmt("b", "AED")?.instructorPayout).toBe(4_000);
  });

  it("is idempotent and never overwrites an acknowledged statement", async () => {
    await call("Bearer e2e-cron");
    const second = await (await call("Bearer e2e-cron")).json();
    expect(second.created).toBe(0);
    expect(h.state.statements).toHaveLength(3);

    stmt("a", "AED")!.status = "ACKNOWLEDGED";
    h.state.ledger.push(entry("a", "AED", "2026-10-10T10:00:00Z", 1_000));
    await call("Bearer e2e-cron");
    expect(stmt("a", "AED")?.instructorPayout).toBe(13_000);
    stmt("a", "KWD")!.status = "OPEN";
    h.state.ledger.push(entry("a", "KWD", "2026-10-10T10:00:00Z", 1_000));
    await call("Bearer e2e-cron");
    expect(stmt("a", "KWD")?.instructorPayout).toBe(4_000);
  });

  it("starts the next statement exactly where the previous one ended", async () => {
    await call("Bearer e2e-cron");
    vi.setSystemTime(new Date("2026-12-01T02:00:00Z")); // cut-off: 2026-11-17
    await call("Bearer e2e-cron");
    const next = h.state.statements.find((s) => s.instructorId === "a" && s.currency === "AED" && s.period === "2026-11")!;
    expect(next.coversFrom).toEqual(new Date("2026-10-18T00:00:00Z"));
    expect(next.instructorPayout).toBe(9_999 + 9_999);
  });
});
