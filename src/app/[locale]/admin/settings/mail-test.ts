"use server";

import { db } from "@/lib/db";
import { emailLayout, sendMailDetailed } from "@/lib/mail";
import { requireAdmin } from "@/lib/staff";

/** Sends one test message to the signed-in owner and returns Resend's own answer, so a failure shows its reason. */
export async function sendTestEmail(): Promise<{ ok: boolean; detail: string; to: string }> {
  const me = await requireAdmin();
  const user = await db.user.findUnique({ where: { id: me.id }, select: { email: true } });
  if (!user?.email) return { ok: false, detail: "Your account has no email address", to: "" };
  const r = await sendMailDetailed({
    to: user.email,
    subject: "Dhirwa test email",
    html: emailLayout("Test email", ["If you can read this, sending works."], undefined, "en"),
  });
  return { ...r, to: user.email };
}
