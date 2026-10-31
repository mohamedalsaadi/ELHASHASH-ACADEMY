// Bank-transfer enrolment: a student creates a pending manual order, transfers the money, and
// attaches the receipt. The owner approves it like any other manual order, and the normal
// settlement path grants access and writes the ledger.

import { priceSkus } from "@/lib/checkout";
import { receiptPrefix, blobInfo, safeDownloadName } from "@/lib/blob";
import { db } from "@/lib/db";
import { vatOn } from "@/lib/finance";
import { getFinanceConfig } from "@/lib/platform-settings";

export type TransferOrder = { id: string; total: number; vat: number; currency: string };

/**
 * Creates (or reuses) the student's pending transfer order for one plan.
 * The amount comes from the pricing engine, never from the browser.
 */
export async function requestTransfer(userId: string, skuId: string): Promise<TransferOrder> {
  const { priced, skus, missing } = await priceSkus([skuId]);
  if (missing) throw new Error("sku_unavailable");
  const sku = skus.get(skuId)!;
  // A live seat is sold and granted from the live page, not through a course transfer.
  if (sku.accessType === "LIVE") throw new Error("live_seat_not_transferable");

  // One open request per student per plan: a second click must not create a second order.
  const existing = await db.order.findFirst({
    where: { userId, status: "PENDING", gateway: "MANUAL", items: { some: { skuId } } },
    orderBy: { createdAt: "desc" },
    select: { id: true, total: true, vat: true, currency: true },
  });
  if (existing) return existing;

  const cfg = await getFinanceConfig();
  const vat = vatOn(priced.total, cfg);

  return db.order.create({
    data: {
      userId,
      gateway: "MANUAL",
      method: null,
      currency: priced.currency,
      subtotal: priced.subtotal,
      discount: priced.discount,
      total: priced.total,
      vat,
      vatRateBp: vat > 0 ? cfg.vatRateBp : 0,
      // No expiry: a transfer can take days, and an expired request loses the student.
      expiresAt: null,
      items: { create: priced.lines.map((l) => ({ skuId: l.skuId, price: l.price - l.discount - l.couponDiscount })) },
    },
    select: { id: true, total: true, vat: true, currency: true },
  });
}

/** The guard for every receipt operation: the order is this student's, pending, and paid by transfer. */
export async function receiptForOrder(orderId: string, userId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { userId: true, status: true, gateway: true },
  });
  if (!order || order.userId !== userId || order.status !== "PENDING" || order.gateway !== "MANUAL") return null;
  return order;
}

/** Saves a receipt the browser already uploaded to the private store. */
export async function saveReceipt(input: { orderId: string; userId: string; pathname: string; name: string }): Promise<boolean> {
  if (!(await receiptForOrder(input.orderId, input.userId))) return false;
  if (!input.pathname.startsWith(receiptPrefix(input.orderId))) return false;
  // Size and type come from Blob, never from the browser.
  const info = await blobInfo(input.pathname);
  if (!info) return false;
  await db.order.update({
    where: { id: input.orderId },
    data: {
      receiptKey: input.pathname,
      receiptName: safeDownloadName(input.name),
      receiptType: info.contentType,
      receiptSize: info.size,
    },
  });
  return true;
}
