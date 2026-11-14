import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const trx = {
    ledgerEntry: { findMany: vi.fn(), createMany: vi.fn() },
    order: { update: vi.fn() },
    entitlement: { updateMany: vi.fn() },
    paymentEvent: { create: vi.fn() },
  };
  return {
    trx,
    db: {
      order: { findUniqueOrThrow: vi.fn() },
      $transaction: vi.fn(async (fn: (t: typeof trx) => unknown) => fn(trx)),
    },
    stripe: { checkout: { sessions: { retrieve: vi.fn() } }, refunds: { create: vi.fn() } },
    refundIntent: vi.fn(),
    issueCreditNote: vi.fn(),
    applyPaymentOutcome: vi.fn(),
  };
});

// actions.ts pulls in most of the app; only the modules the two order actions touch are driven.
vi.mock("@/lib/db", () => ({ db: h.db }));
vi.mock("@/lib/stripe", () => ({ stripe: () => h.stripe }));
vi.mock("@/lib/ziina", () => ({ refundIntent: h.refundIntent }));
vi.mock("@/lib/documents", () => ({ issueCreditNote: h.issueCreditNote }));
vi.mock("@/lib/payments", () => ({ applyPaymentOutcome: h.applyPaymentOutcome }));
vi.mock("@/lib/staff", () => ({
  requireAdmin: vi.fn(async () => ({ id: "admin-1" })),
  requireStaff: vi.fn(),
  assertCourse: vi.fn(),
  assertSlot: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@vercel/blob", () => ({ del: vi.fn() }));
vi.mock("@/generated/prisma/client", () => ({ Prisma: {} }));
vi.mock("@/lib/analytics", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/blob", () => ({ blobInfo: vi.fn(), coverPrefix: vi.fn(), lessonPagesPrefix: vi.fn(), ownPaths: vi.fn() }));
vi.mock("@/lib/platform-settings", () => ({ saveFinanceConfig: vi.fn() }));
vi.mock("@/lib/invites", () => ({ issueInvite: vi.fn() }));
vi.mock("@/lib/mail", () => ({ appUrl: vi.fn(), emailLayout: vi.fn(), sendMail: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ isLimited: vi.fn(), recordAttempt: vi.fn() }));
vi.mock("@/lib/new-course-alerts", () => ({ notifyNewCourse: vi.fn() }));
vi.mock("@/lib/course-published-alert", () => ({ notifyCoursePublished: vi.fn() }));
vi.mock("@/lib/publish-check", () => ({ courseReadiness: vi.fn() }));

import { markOrderPaid, refundOrder } from "./actions";

const form = (id = "order-1") => {
  const f = new FormData();
  f.set("id", id);
  return f;
};

const baseOrder = { id: "order-1", status: "PAID", gateway: "ZIINA", gatewayOrderId: "pi_1", total: 30_000, vat: 1_500, currency: "AED" };

const sale = {
  id: "sale-1",
  orderItemId: "item-1",
  instructorId: "teacher-1",
  courseId: "course-1",
  subjectId: "math",
  gradeId: "g12",
  currency: "AED",
  gross: 31_500,
  vat: 1_500,
  net: 30_000,
  platformFee: 9_000,
  instructorNet: 21_000,
  corporateTax: 810,
  corporateTaxBp: 900,
  instructorPayout: 20_190,
  platformDiscount: 500,
  vatRateBp: 500,
  platformShareBp: 3000,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.db.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder });
  h.trx.ledgerEntry.findMany.mockResolvedValue([sale]);
  h.issueCreditNote.mockResolvedValue(undefined);
});

describe("refundOrder", () => {
  it("does nothing for an order that is not PAID", async () => {
    h.db.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, status: "REFUNDED" });
    await refundOrder(form());
    expect(h.refundIntent).not.toHaveBeenCalled();
    expect(h.stripe.refunds.create).not.toHaveBeenCalled();
    expect(h.db.$transaction).not.toHaveBeenCalled();
    expect(h.issueCreditNote).not.toHaveBeenCalled();
  });

  it("refunds Ziina for total plus VAT, then records exact negative ledger rows and closes access", async () => {
    await refundOrder(form());
    expect(h.refundIntent).toHaveBeenCalledWith({ orderId: "order-1", paymentIntentId: "pi_1", amount: 31_500 });

    expect(h.trx.order.update).toHaveBeenCalledWith({ where: { id: "order-1" }, data: { status: "REFUNDED" } });
    const ent = h.trx.entitlement.updateMany.mock.calls[0][0];
    expect(ent.where).toEqual({ orderId: "order-1" });
    expect(ent.data.endsAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(h.trx.paymentEvent.create.mock.calls[0][0].data.gatewayEventId).toBe("refund:order-1");

    const { data } = h.trx.ledgerEntry.createMany.mock.calls[0][0];
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      kind: "REFUND",
      reversalOfId: "sale-1",
      gross: -31_500,
      vat: -1_500,
      net: -30_000,
      platformFee: -9_000,
      instructorNet: -21_000,
      corporateTax: -810,
      instructorPayout: -20_190,
      platformDiscount: -500,
      corporateTaxBp: 900,
      vatRateBp: 500,
      platformShareBp: 3000,
    });
    expect(h.issueCreditNote).toHaveBeenCalledWith("order-1");
  });

  it("refunds Stripe through the payment intent with the per-order idempotency key", async () => {
    h.db.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, gateway: "STRIPE", gatewayOrderId: "cs_1" });
    h.stripe.checkout.sessions.retrieve.mockResolvedValue({ payment_intent: "pi_stripe" });
    await refundOrder(form());
    expect(h.stripe.refunds.create).toHaveBeenCalledWith({ payment_intent: "pi_stripe" }, { idempotencyKey: "refund:order-1" });
    expect(h.trx.order.update).toHaveBeenCalled();
  });

  it("records nothing when a Stripe session has no payment intent", async () => {
    h.db.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, gateway: "STRIPE", gatewayOrderId: "cs_1" });
    h.stripe.checkout.sessions.retrieve.mockResolvedValue({ payment_intent: null });
    await expect(refundOrder(form())).rejects.toThrow(/payment_intent/);
    expect(h.stripe.refunds.create).not.toHaveBeenCalled();
    expect(h.db.$transaction).not.toHaveBeenCalled();
    expect(h.issueCreditNote).not.toHaveBeenCalled();
  });

  it.each(["STRIPE", "ZIINA"])("records nothing for a %s order with no gateway reference", async (gateway) => {
    h.db.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, gateway, gatewayOrderId: null });
    await expect(refundOrder(form())).rejects.toThrow(/no .* reference/);
    expect(h.refundIntent).not.toHaveBeenCalled();
    expect(h.stripe.refunds.create).not.toHaveBeenCalled();
    expect(h.db.$transaction).not.toHaveBeenCalled();
  });

  it("still records a Paymob refund without calling a gateway (refunded in its dashboard)", async () => {
    h.db.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, gateway: "PAYMOB", gatewayOrderId: null });
    await refundOrder(form());
    expect(h.refundIntent).not.toHaveBeenCalled();
    expect(h.stripe.refunds.create).not.toHaveBeenCalled();
    expect(h.trx.order.update).toHaveBeenCalled();
  });

  it("a racing second refund fails on the fixed event key and writes no second ledger set", async () => {
    h.trx.paymentEvent.create.mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }));
    await expect(refundOrder(form())).rejects.toThrow("unique");
    expect(h.trx.ledgerEntry.createMany).not.toHaveBeenCalled();
    expect(h.issueCreditNote).not.toHaveBeenCalled();
  });

  it("keeps the refund when the credit note fails", async () => {
    h.issueCreditNote.mockRejectedValueOnce(new Error("pdf"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(refundOrder(form())).resolves.toBeUndefined();
    expect(h.trx.ledgerEntry.createMany).toHaveBeenCalled();
  });
});

describe("markOrderPaid", () => {
  it("is skipped when the order is already PAID", async () => {
    await markOrderPaid(form());
    expect(h.applyPaymentOutcome).not.toHaveBeenCalled();
  });

  it("settles a pending order for total plus VAT, attributed to the admin", async () => {
    h.db.order.findUniqueOrThrow.mockResolvedValue({ ...baseOrder, status: "PENDING" });
    await markOrderPaid(form());
    expect(h.applyPaymentOutcome).toHaveBeenCalledWith(
      "order-1",
      expect.stringMatching(/^manual:/),
      { kind: "paid", amount: 31_500, currency: "AED" },
      { admin: "admin-1" },
    );
  });
});
