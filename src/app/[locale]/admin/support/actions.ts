"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { emailLayout, sendMail } from "@/lib/mail";
import { requireAdmin } from "@/lib/staff";

/** The owner sends their (possibly edited) reply; this is the only path a ticket answer leaves by. */
export async function replyTicket(form: FormData) {
  const me = await requireAdmin();
  const d = z.object({ id: z.string().min(1), reply: z.string().trim().min(2).max(4000) }).safeParse(Object.fromEntries(form));
  if (!d.success) return;
  const ticket = await db.supportTicket.findUnique({ where: { id: d.data.id }, select: { email: true, status: true, message: true } });
  if (!ticket || ticket.status === "CLOSED") return;

  const ar = /[\u0600-\u06FF]/.test(ticket.message);
  const subject = ar ? "رد من ذروة" : "Reply from Dhirwa";
  const sent = await sendMail({ to: ticket.email, subject, html: emailLayout(subject, d.data.reply.split(/\n{2,}/), undefined, ar ? "ar" : "en") });
  if (!sent) return;

  await db.supportTicket.update({
    where: { id: d.data.id },
    data: { status: "ANSWERED", reply: d.data.reply, repliedById: me.id, repliedAt: new Date() },
  });
  revalidatePath("/[locale]/admin/support", "page");
  revalidatePath("/[locale]/admin", "page");
}

export async function closeTicket(form: FormData) {
  await requireAdmin();
  const { id } = z.object({ id: z.string().min(1) }).parse(Object.fromEntries(form));
  await db.supportTicket.update({ where: { id }, data: { status: "CLOSED" } });
  revalidatePath("/[locale]/admin/support", "page");
  revalidatePath("/[locale]/admin", "page");
}
