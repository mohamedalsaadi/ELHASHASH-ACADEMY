import type { Currency } from "@/lib/pricing-engine";

export type EarningRow = { createdAt: Date; currency: Currency; courseId: string; gross: number; instructorNet: number };
export type EarningGroup = { key: string; currency: Currency; sales: number; gross: number; net: number };

/** Sums ledger rows by a key (a month or a course) and currency. Refund rows are negative, so they net out. */
export function groupEarnings(rows: EarningRow[], keyOf: (r: EarningRow) => string): EarningGroup[] {
  const out = new Map<string, EarningGroup>();
  for (const r of rows) {
    const key = keyOf(r);
    const id = `${key}|${r.currency}`;
    const g = out.get(id) ?? { key, currency: r.currency, sales: 0, gross: 0, net: 0 };
    g.sales += r.gross >= 0 ? 1 : -1;
    g.gross += r.gross;
    g.net += r.instructorNet;
    out.set(id, g);
  }
  return [...out.values()];
}

/** "2026-11" in UTC, the same month boundary the dashboard tile uses. */
export const monthKey = (d: Date) => d.toISOString().slice(0, 7);
