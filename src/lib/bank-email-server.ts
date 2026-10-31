// Database side of the bank-alert flow. Kept apart from bank-email.ts so the matching rules
// stay importable by tests without pulling in the Prisma client.

import { Prisma } from "@/generated/prisma/client";
import {
  extractOrderIdCandidates,
  matchBankEmail,
  normalizeCurrency,
  parseAmountToMinor,
  parseBankEmailWithAi,
  type MatchOrder,
} from "@/lib/bank-email";
import { db } from "@/lib/db";
import { applyPaymentOutcome } from "@/lib/payments";

export type InboundEmail = {
  messageId: string;
  provider: string;
  fromAddress: string;
  toAddress: string;
  subject: string | null;
  receivedAt: Date;
  auth: unknown;
  bodyText: string;
  /** True only when the sender is allowlisted and SPF/DKIM/DMARC all pass. */
  authenticated: boolean;
  /** True when the message is definitely not from the bank; it is stored and ignored. */
  blocked: boolean;
};

const TERMINAL = new Set(["AUTO_APPROVED", "MATCHED", "REJECTED", "DUPLICATE"]);

/**
 * Stores the alert, parses it, and settles the matching order when the evidence is exact.
 * Logical rejections return a queued status; only a transient failure throws, so the provider retries.
 */
export async function receiveBankEmail(input: InboundEmail) {
  const existing = await db.bankEmail.findUnique({ where: { messageId: input.messageId }, select: { status: true } });
  if (existing && TERMINAL.has(existing.status)) return { status: existing.status, duplicate: true };

  const base = {
    messageId: input.messageId,
    provider: input.provider,
    fromAddress: input.fromAddress,
    toAddress: input.toAddress,
    subject: input.subject,
    receivedAt: input.receivedAt,
    auth: (input.auth ?? undefined) as Prisma.InputJsonValue | undefined,
    bodyText: input.bodyText.slice(0, 20000),
  };

  if (input.blocked) {
    // Keep the row so the owner can see what was refused, but never act on it.
    await db.bankEmail.upsert({
      where: { messageId: input.messageId },
      create: { ...base, status: "REJECTED", reason: "not_authenticated" },
      update: { status: "REJECTED", reason: "not_authenticated" },
    });
    return { status: "REJECTED" as const, reason: "not_authenticated" };
  }

  const parsed = await parseBankEmailWithAi(input.subject, input.bodyText);
  const currency = normalizeCurrency(parsed?.currency ?? null);
  const amountMinor = parseAmountToMinor(parsed?.amount ?? null, currency);
  const orderIds = extractOrderIdCandidates(`${parsed?.reference ?? ""} ${input.bodyText}`);

  const orders = orderIds.length
    ? await db.order.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, status: true, gateway: true, currency: true, total: true, vat: true },
      })
    : [];
  const matchOrders: MatchOrder[] = orders.map((o) => ({
    id: o.id,
    status: o.status,
    gateway: o.gateway,
    currency: o.currency,
    payable: o.total + o.vat,
  }));

  const setting = await db.platformSetting.findUnique({ where: { id: "singleton" }, select: { bankAutoApprove: true } });
  const autoApprove = (setting?.bankAutoApprove ?? false) && process.env.BANK_AUTO_APPROVE === "1";

  const result = matchBankEmail({
    parsed,
    amountMinor,
    currency,
    orderIds,
    orders: matchOrders,
    bodyText: input.bodyText,
    authenticated: input.authenticated,
    autoApprove,
  });

  const parsedFields = {
    parsed: (parsed ?? undefined) as Prisma.InputJsonValue | undefined,
    amount: amountMinor,
    currency,
    senderName: parsed?.senderName ?? null,
    reference: parsed?.reference ?? null,
    bankTransactionId: parsed?.bankTransactionId ?? null,
    valueDate: parsed?.valueDate ? new Date(parsed.valueDate) : null,
  };

  try {
    if (result.kind === "queue") {
      // An unauthenticated but not blocked message still shows in the queue for the owner.
      const status = "NEEDS_REVIEW";
      await db.bankEmail.upsert({
        where: { messageId: input.messageId },
        create: { ...base, ...parsedFields, status, reason: result.reason },
        update: { ...parsedFields, status, reason: result.reason },
      });
      return { status, reason: result.reason };
    }

    // The settlement is the source of truth; the row update is bookkeeping around it.
    const applied = await applyPaymentOutcome(
      result.orderId,
      `email:${input.messageId}`,
      { kind: "paid", amount: result.amount, currency: result.currency },
      { bankEmail: input.messageId, from: input.fromAddress, amount: parsed?.amount },
    );
    // false means this event id already settled: a retry, not a second payment.
    let status: "AUTO_APPROVED" | "DUPLICATE" = "AUTO_APPROVED";
    if (!applied) {
      const order = await db.order.findUnique({ where: { id: result.orderId }, select: { status: true } });
      status = order?.status === "PAID" ? "AUTO_APPROVED" : "DUPLICATE";
    }
    await db.bankEmail.upsert({
      where: { messageId: input.messageId },
      create: { ...base, ...parsedFields, status, reason: null, orderId: result.orderId, matchedAt: new Date() },
      update: { ...parsedFields, status, reason: null, orderId: result.orderId, matchedAt: new Date() },
    });
    return { status, orderId: result.orderId, applied };
  } catch (e) {
    // A repeated bank transaction id (or a racing message id) is a duplicate, not a failure.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { status: "DUPLICATE" as const, duplicate: true };
    }
    throw e;
  }
}
