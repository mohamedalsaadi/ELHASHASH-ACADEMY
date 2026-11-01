// Pure access-date maths; kept apart from payments.ts so tests don't load the database.

const DAY_MS = 86_400_000;

/** When access bought at `paidAt` stops: a fixed end date wins, else `accessDays` from payment; null means perpetual. */
export function accessEnd(sku: { accessEndsAt: Date | null; accessDays: number | null }, paidAt: Date): Date | null {
  return sku.accessEndsAt ?? (sku.accessDays ? new Date(paidAt.getTime() + sku.accessDays * DAY_MS) : null);
}

/** The UAE and Egyptian school year ends on 15 July: this year's until that day, next year's after it. Returns "YYYY-MM-DD". */
export function schoolYearEnd(now: Date): string {
  const y = now.getUTCFullYear();
  const passed = now.getUTCMonth() > 6 || (now.getUTCMonth() === 6 && now.getUTCDate() > 15);
  return `${passed ? y + 1 : y}-07-15`;
}

/** Who gets the access an order buys: the linked child a parent paid for, otherwise the buyer. */
export function learnerOf(order: { userId: string; beneficiaryId: string | null }): string {
  return order.beneficiaryId ?? order.userId;
}
