"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { redirectLocal } from "@/lib/redirect-locale";
import { requireAdmin } from "@/lib/staff";
import { sendTeacherInvites, sendTeacherInviteTest } from "@/lib/teacher-outreach";

// Every action re-checks the role: server actions are public endpoints, whatever page renders them.

const lang = z.enum(["ar", "en"]);
const send = z.object({ emails: z.string().min(3).max(4000), lang, confirm: z.literal("on") });

/** Emails the invitation to the typed addresses, then returns to the panel with what was sent, skipped and refused. */
export async function sendTeacherInvitations(form: FormData) {
  const me = await requireAdmin();
  const d = send.safeParse(Object.fromEntries(form));
  if (!d.success) return redirectLocal("/admin/teachers?outreach=invalid#outreach");
  const mine = await db.user.findUnique({ where: { id: me.id }, select: { email: true } });
  const r = await sendTeacherInvites({ text: d.data.emails, locale: d.data.lang, adminId: me.id, replyTo: mine?.email });
  const q = new URLSearchParams({ outreach: "done", sent: String(r.sent), already: String(r.already), failed: String(r.failed), invalid: String(r.invalid), tooMany: String(r.tooMany) });
  if (r.detail) q.set("detail", r.detail);
  return redirectLocal(`/admin/teachers?${q}#outreach`);
}

/** The invitation to the admin's own address only. */
export async function sendTeacherInviteTestCopy(form: FormData) {
  const me = await requireAdmin();
  const l = lang.safeParse(form.get("lang"));
  const mine = await db.user.findUnique({ where: { id: me.id }, select: { email: true } });
  if (!l.success || !mine?.email) return redirectLocal("/admin/teachers?outreach=noemail#outreach");
  const r = await sendTeacherInviteTest({ to: mine.email, locale: l.data });
  return redirectLocal(`/admin/teachers?outreach=${r.ok ? "test_ok" : "test_fail"}#outreach`);
}

/** The person asked to stop: the address stays on file and is never mailed again. */
export async function markOutreachStopped(form: FormData) {
  await requireAdmin();
  const id = z.string().min(1).safeParse(form.get("id"));
  if (!id.success) return;
  await db.teacherOutreach.updateMany({ where: { id: id.data, stoppedAt: null }, data: { stoppedAt: new Date() } });
  revalidatePath("/[locale]/admin/teachers", "page");
}
