"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clientIp } from "@/lib/client-ip";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/staff";

/** The teacher confirms their own month totals. A double click is one acknowledgement. */
export async function acknowledgeStatement(form: FormData) {
  const me = await requireStaff();
  const { id } = z.object({ id: z.string() }).parse(Object.fromEntries(form));
  const h = await headers();
  await db.teacherStatement.updateMany({
    where: { id, instructorId: me.id, status: "OPEN" },
    data: {
      status: "ACKNOWLEDGED",
      acknowledgedAt: new Date(),
      ackIp: clientIp(h),
      ackUserAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  revalidatePath("/[locale]/teacher/earnings", "page");
}

/** The teacher confirms the earning lines on one buyer document, without seeing the buyer's copy. */
export async function acknowledgeReceipt(form: FormData) {
  const me = await requireStaff();
  const { id } = z.object({ id: z.string() }).parse(Object.fromEntries(form));
  const doc = await db.document.findUnique({ where: { id }, select: { id: true, orderId: true } });
  if (!doc) return;
  const line = await db.ledgerEntry.findFirst({
    where: { orderId: doc.orderId, instructorId: me.id, kind: "SALE" },
    select: { id: true },
  });
  if (!line) return;
  const h = await headers();
  await db.receiptAck.upsert({
    where: { documentId_teacherId: { documentId: doc.id, teacherId: me.id } },
    create: {
      documentId: doc.id,
      teacherId: me.id,
      ip: clientIp(h),
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    },
    update: {},
  });
  revalidatePath("/[locale]/teacher/earnings", "page");
}
