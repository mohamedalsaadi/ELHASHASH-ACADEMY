"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { createNotification } from "@/lib/notify";
import { requireAdmin } from "@/lib/staff";

/**
 * The owner transferred the money from the bank and records it. Only an acknowledged, positive, unpaid statement of a teacher with
 * bank details can be marked, once. The teacher gets a notice and an email with the reference.
 */
export async function markPayoutPaid(form: FormData) {
  const me = await requireAdmin();
  const d = z.object({ id: z.string().min(1), reference: z.string().trim().min(3).max(100) }).parse(Object.fromEntries(form));
  const s = await db.teacherStatement.findUnique({ where: { id: d.id }, include: { instructor: { select: { payoutIban: true, payoutHolder: true } } } });
  if (!s || s.paidAt || s.status !== "ACKNOWLEDGED" || s.instructorPayout <= 0 || !s.instructor.payoutIban || !s.instructor.payoutHolder) return;
  // The paidAt guard in the filter makes a double click or a second admin harmless.
  const marked = await db.teacherStatement.updateMany({ where: { id: d.id, paidAt: null }, data: { paidAt: new Date(), paidReference: d.reference, paidById: me.id } });
  if (!marked.count) return;
  await createNotification({
    userId: s.instructorId,
    kind: "PAYOUT_PAID",
    titleAr: `تم تحويل كشف ${s.period}`,
    titleEn: `Your ${s.period} statement was paid`,
    bodyAr: `المبلغ: ${formatMoney(s.instructorPayout, s.currency, "ar")}. المرجع: ${d.reference}`,
    bodyEn: `Amount: ${formatMoney(s.instructorPayout, s.currency, "en")}. Reference: ${d.reference}`,
    href: "/teacher/earnings",
    dedupeKey: `payout:${s.id}`,
  });
  revalidatePath("/[locale]/admin/payouts", "page");
  revalidatePath("/[locale]/teacher/earnings", "page");
}
