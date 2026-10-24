import type { Currency } from "@/lib/pricing-engine";

/**
 * Sales per currency from paid order lines. A bundle discount is shared across its lines by price.
 * ponytail: per-teacher payout rules go here if they ever differ.
 */
export function earningsByCurrency(lines: { price: number; order: { subtotal: number; total: number; currency: Currency } }[]) {
  const out = new Map<Currency, number>();
  for (const { price, order } of lines) {
    const share = order.subtotal ? Math.round((price * order.total) / order.subtotal) : 0;
    out.set(order.currency, (out.get(order.currency) ?? 0) + share);
  }
  return out;
}
