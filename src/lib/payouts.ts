// Which teacher statements the owner can pay today. The platform never moves money: the owner transfers from the bank and records it.
import { db } from "./db";

export type PayoutState = "paid" | "ready" | "needsAck" | "needsDetails" | "nothing";

/** Pure, so the rules are tested without a database. */
export function payoutState(s: { instructorPayout: number; status: "OPEN" | "ACKNOWLEDGED"; paidAt: Date | null }, hasDetails: boolean): PayoutState {
  if (s.paidAt) return "paid";
  if (s.instructorPayout <= 0) return "nothing";
  if (s.status !== "ACKNOWLEDGED") return "needsAck";
  if (!hasDetails) return "needsDetails";
  return "ready";
}

export async function loadPayouts() {
  const rows = await db.teacherStatement.findMany({
    orderBy: [{ period: "desc" }, { currency: "asc" }],
    take: 300,
    include: { instructor: { select: { id: true, name: true, payoutHolder: true, payoutBank: true, payoutIban: true } } },
  });
  return rows.map((s) => ({ ...s, state: payoutState(s, !!(s.instructor.payoutIban && s.instructor.payoutHolder)) }));
}

/** Statements ready to pay, for the briefing and the owner's badge. */
export const readyPayoutCount = async () => (await loadPayouts()).filter((s) => s.state === "ready").length;
