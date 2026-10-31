"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { applyPaymentOutcome } from "@/lib/payments";
import { requireAdmin } from "@/lib/staff";

const SETTLED = new Set(["AUTO_APPROVED", "MATCHED", "DUPLICATE"]);

/**
 * The owner asserts the match. The parsed amount was only a suggestion, so the order's own
 * payable is what gets settled — the ledger is always built from the order's line prices.
 */
export async function matchBankEmailManually(form: FormData) {
  const me = await requireAdmin();
  const d = z.object({ id: z.string(), orderId: z.string() }).parse(Object.fromEntries(form));

  const email = await db.bankEmail.findUniqueOrThrow({
    where: { id: d.id },
    select: { messageId: true, status: true, orderId: true },
  });
  if (email.orderId || SETTLED.has(email.status)) return;

  const order = await db.order.findUniqueOrThrow({
    where: { id: d.orderId },
    select: { id: true, status: true, total: true, vat: true, currency: true },
  });
  if (order.status !== "PENDING") return;

  await applyPaymentOutcome(
    order.id,
    `email:${email.messageId}`,
    { kind: "paid", amount: order.total + order.vat, currency: order.currency },
    { admin: me.id, bankEmail: email.messageId },
  );

  await db.bankEmail.updateMany({
    where: { id: d.id, orderId: null },
    data: { status: "MATCHED", orderId: order.id, matchedById: me.id, matchedAt: new Date() },
  });

  revalidatePath("/[locale]/admin/transfers", "page");
  revalidatePath("/[locale]/admin/orders", "layout");
  revalidatePath("/[locale]/dashboard", "page");
}

/** Removes an alert from the queue without settling anything. */
export async function dismissBankEmail(form: FormData) {
  await requireAdmin();
  const { id } = z.object({ id: z.string() }).parse(Object.fromEntries(form));
  await db.bankEmail.updateMany({
    where: { id, orderId: null, status: { in: ["NEEDS_REVIEW", "RECEIVED", "FAILED"] } },
    data: { status: "REJECTED", reason: "dismissed" },
  });
  revalidatePath("/[locale]/admin/transfers", "page");
}
