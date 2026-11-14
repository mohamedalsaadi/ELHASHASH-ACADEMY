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

const instructor = { select: { id: true, name: true, payoutHolder: true, payoutBank: true, payoutIban: true } } as const;

/** Unpaid statements with money owed: small, so no row cap. Paid ones are history, only the latest 20 are shown. */
export async function loadPayouts() {
  const [unpaid, paid] = await Promise.all([
    db.teacherStatement.findMany({
      where: { paidAt: null, instructorPayout: { gt: 0 } },
      orderBy: [{ period: "desc" }, { currency: "asc" }],
      include: { instructor },
    }),
    db.teacherStatement.findMany({ where: { paidAt: { not: null } }, orderBy: { paidAt: "desc" }, take: 20, include: { instructor } }),
  ]);
  return [...unpaid, ...paid].map((s) => ({ ...s, state: payoutState(s, !!(s.instructor.payoutIban && s.instructor.payoutHolder)) }));
}

/** Statements ready to pay, for the briefing and the owner's badge. Mirrors payoutState "ready"; "" counts as missing, like the truthiness check above. */
export const readyPayoutCount = () =>
  db.teacherStatement.count({
    where: {
      paidAt: null,
      status: "ACKNOWLEDGED",
      instructorPayout: { gt: 0 },
      instructor: { AND: [{ payoutIban: { not: null } }, { payoutIban: { not: "" } }, { payoutHolder: { not: null } }, { payoutHolder: { not: "" } }] },
    },
  });
