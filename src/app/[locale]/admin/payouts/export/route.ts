import { csvResponse } from "@/lib/csv";
import { minorPerUnit } from "@/lib/format";
import { loadPayouts } from "@/lib/payouts";
import { requireAdmin } from "@/lib/staff";

export const dynamic = "force-dynamic";

/** Everything ready to pay, one line per statement, for the bank's bulk-transfer upload. Amounts are in major units. */
export async function GET() {
  await requireAdmin();
  const ready = (await loadPayouts()).filter((s) => s.state === "ready");
  const lines: unknown[][] = [["account_holder", "bank", "iban", "amount", "currency", "reference"]];
  for (const s of ready) {
    lines.push([s.instructor.payoutHolder, s.instructor.payoutBank, s.instructor.payoutIban, (s.instructorPayout / minorPerUnit(s.currency)).toFixed(minorPerUnit(s.currency) === 1000 ? 3 : 2), s.currency, `DHIRWA-${s.period}`]);
  }
  return csvResponse(lines, `dhirwa-payouts-${new Date().toISOString().slice(0, 10)}.csv`);
}
