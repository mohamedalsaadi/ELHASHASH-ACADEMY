import { beforeEach, describe, expect, it, vi } from "vitest";

// A minimal stand-in for the generated Prisma error class, so a duplicate event can be simulated.
vi.mock("@/generated/prisma/client", () => ({
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {
      code: string;
      constructor(message: string, options: { code: string }) {
        super(message);
        this.code = options.code;
      }
    },
  },
}));

// The client is built at import time from DATABASE_URL; this file drives a fake transaction instead.
const h = vi.hoisted(() => ({ db: { $transaction: null as unknown as (fn: (trx: unknown) => unknown) => unknown } }));
vi.mock("@/lib/db", () => ({ db: h.db }));
vi.mock("@/lib/notify", () => ({ notifyOrderPaid: vi.fn(async () => {}), createNotification: vi.fn(async () => null) }));
vi.mock("@/lib/analytics", () => ({ logEvent: vi.fn(async () => {}) }));

import { Prisma } from "@/generated/prisma/client";
import { applyPaymentOutcome } from "./payments";

type Row = Record<string, unknown>;

const order = {
  id: "order-1",
  status: "PENDING",
  userId: "student-1",
  beneficiaryId: null as string | null,
  total: 30_000,
  vat: 0,
  currency: "AED",
  gateway: "ZIINA",
  paidAt: null as Date | null,
  referral: null as null | { id: string; status: string; referrerId: string },
};

const line = {
  id: "item-1",
  price: 30_000,
  platformDiscount: 0,
  sku: {
    courseId: "course-1",
    lessonId: null,
    liveSessionId: null,
    accessType: "SEMESTER",
    term: null,
    month: null,
    accessEndsAt: null,
    accessDays: 180,
    course: { instructorId: "teacher-1", subjectId: "math", gradeId: "grade-12" },
  },
};

/**
 * Models the two columns the real database leans on: gatewayEventId is unique, and the PAID
 * transition only counts when the order was not already paid.
 */
function fakeDatabase(seed: Partial<typeof order> = {}, opts: { throwOnEntitlement?: boolean; rewardPercent?: number } = {}) {
  const state = { ...order, ...seed };
  const seenEvents = new Set<string>();
  const entitlements: Row[] = [];
  const ledger: Row[] = [];
  const coupons: Row[] = [];

  const trx = {
    paymentEvent: {
      create: async ({ data }: { data: { gatewayEventId: string } }) => {
        if (seenEvents.has(data.gatewayEventId)) {
          throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
        }
        seenEvents.add(data.gatewayEventId);
        return data;
      },
    },
    order: {
      findUniqueOrThrow: async () => ({ ...state, items: [line] }),
      updateMany: async ({ where, data }: { where: { status?: { not?: string } | string }; data: Row }) => {
        const not = (where.status as { not?: string } | undefined)?.not;
        if (not && state.status === not) return { count: 0 };
        const is = typeof where.status === "string" ? where.status : null;
        if (is && state.status !== is) return { count: 0 };
        state.status = data.status as string;
        return { count: 1 };
      },
    },
    entitlement: {
      createMany: async ({ data }: { data: Row[] }) => {
        if (opts.throwOnEntitlement) {
          throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
        }
        entitlements.push(...data);
        return { count: data.length };
      },
    },
    ledgerEntry: { createMany: async ({ data }: { data: Row[] }) => (ledger.push(...data), { count: data.length }) },
    referral: {
      deleteMany: async () => ({ count: 0 }),
      updateMany: async () => ({ count: state.referral ? 1 : 0 }),
      update: async () => ({}),
    },
    coupon: { create: async ({ data }: { data: Row }) => (coupons.push(data), { id: "coupon-1", ...data }) },
    platformSetting: { findUnique: async () => (opts.rewardPercent ? { referralRewardPercentOff: opts.rewardPercent } : null) },
  };

  h.db.$transaction = (fn) => fn(trx);
  return { state, entitlements, ledger, coupons };
}

const paid = { kind: "paid" as const, amount: 30_000, currency: "AED" };

beforeEach(() => {
  h.db.$transaction = null as unknown as typeof h.db.$transaction;
});

describe("applyPaymentOutcome", () => {
  it("rethrows a unique violation that is not the event insert", async () => {
    // Only the event row is meant to be unique here. Anything else must fail loudly so the
    // gateway retries instead of the caller recording a paid order as already handled.
    fakeDatabase({}, { throwOnEntitlement: true });
    await expect(applyPaymentOutcome("order-1", "ziina:pi_1:completed", paid, {})).rejects.toThrow(/Unique/);
  });

  it("grants access and writes one 30/70 ledger row on a first payment", async () => {
    const fake = fakeDatabase();

    expect(await applyPaymentOutcome("order-1", "ziina:pi_1:completed", paid, {})).toBe(true);

    expect(fake.state.status).toBe("PAID");
    expect(fake.entitlements).toHaveLength(1);
    expect(fake.entitlements[0]).toMatchObject({ userId: "student-1", courseId: "course-1", orderId: "order-1" });
    expect(fake.entitlements[0].endsAt).toBeInstanceOf(Date);

    expect(fake.ledger).toHaveLength(1);
    expect(fake.ledger[0]).toMatchObject({
      kind: "SALE",
      gross: 30_000,
      vat: 0,
      net: 30_000,
      platformFee: 9_000,
      instructorNet: 21_000,
      platformShareBp: 3_000,
      vatRateBp: 0,
    });
  });

  it("drops a replayed event and grants nothing a second time", async () => {
    const fake = fakeDatabase();

    expect(await applyPaymentOutcome("order-1", "ziina:pi_1:completed", paid, {})).toBe(true);
    expect(await applyPaymentOutcome("order-1", "ziina:pi_1:completed", paid, {})).toBe(false);

    expect(fake.entitlements).toHaveLength(1);
    expect(fake.ledger).toHaveLength(1);
  });

  it("grants nothing when the order is already paid under a different event id", async () => {
    const fake = fakeDatabase({ status: "PAID", paidAt: new Date() });

    // A fresh event id, so the unique key does not stop it: the not-PAID condition must.
    expect(await applyPaymentOutcome("order-1", "ziina:pi_1:completed:2", paid, {})).toBe(true);

    expect(fake.entitlements).toHaveLength(0);
    expect(fake.ledger).toHaveLength(0);
  });

  it("refuses a payment whose amount does not match the order", async () => {
    const fake = fakeDatabase();

    await expect(applyPaymentOutcome("order-1", "evt", { ...paid, amount: 29_999 }, {})).rejects.toThrow(/mismatch/i);

    expect(fake.state.status).toBe("PENDING");
    expect(fake.entitlements).toHaveLength(0);
    expect(fake.ledger).toHaveLength(0);
  });

  it("refuses a payment in another currency", async () => {
    const fake = fakeDatabase();
    await expect(applyPaymentOutcome("order-1", "evt", { ...paid, currency: "USD" }, {})).rejects.toThrow(/mismatch/i);
    expect(fake.state.status).toBe("PENDING");
  });

  it("marks a failed payment failed and grants nothing", async () => {
    const fake = fakeDatabase();
    expect(await applyPaymentOutcome("order-1", "evt", { kind: "failed" }, {})).toBe(true);
    expect(fake.state.status).toBe("FAILED");
    expect(fake.entitlements).toHaveLength(0);
    expect(fake.ledger).toHaveLength(0);
  });

  it("marks a canceled payment expired and grants nothing", async () => {
    const fake = fakeDatabase();
    await applyPaymentOutcome("order-1", "evt", { kind: "expired" }, {});
    expect(fake.state.status).toBe("EXPIRED");
    expect(fake.entitlements).toHaveLength(0);
  });

  it("mints the referrer's reward coupon in the uppercase form resolveCoupon looks up", async () => {
    const fake = fakeDatabase({ referral: { id: "cmabc123xyz", status: "PENDING", referrerId: "parent-1" } }, { rewardPercent: 10 });
    await applyPaymentOutcome("order-1", "evt", paid, {});
    expect(fake.coupons).toHaveLength(1);
    expect(fake.coupons[0].code).toBe("RW-CMABC123XYZ");
    expect(fake.coupons[0].code).toMatch(/^[A-Z0-9_-]{3,32}$/);
  });

  it("gives the access to the child a parent paid for", async () => {
    const fake = fakeDatabase({ beneficiaryId: "child-1" });
    await applyPaymentOutcome("order-1", "evt", paid, {});
    expect(fake.entitlements[0].userId).toBe("child-1");
  });
});
