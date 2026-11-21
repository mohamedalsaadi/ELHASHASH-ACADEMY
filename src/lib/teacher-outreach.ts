// Emails the teacher invitation from the admin. One row per address (TeacherOutreach), so nobody is mailed twice and
// anyone who asked to stop is never mailed again. Replies go to the admin's own address: there is no shared mailbox.
import { z } from "zod";
import { db } from "@/lib/db";
import { sendMailDetailed } from "@/lib/mail";
import { getFinanceConfig } from "@/lib/platform-settings";
import { renderTeacherInviteEmail, teacherInviteSubject, teacherSharePercent, type InviteLocale } from "@/lib/teacher-invite-email";

/** One send is small on purpose: every address is typed or pasted by hand and checked by eye. */
export const MAX_PER_SEND = 20;

const emailSchema = z.email();

/** Splits pasted text on spaces, commas, semicolons and line breaks; lowercases, drops repeats, separates the bad ones. */
export function parseEmails(text: string): { valid: string[]; invalid: string[] } {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/[\s,;،]+/)) {
    const e = raw.trim().replace(/^<|>$/g, "").toLowerCase();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    (emailSchema.safeParse(e).success ? valid : invalid).push(e);
  }
  return { valid, invalid };
}

export type OutreachResult = { sent: number; already: number; failed: number; invalid: number; tooMany: number; detail?: string };

export async function sendTeacherInvites(input: { text: string; locale: InviteLocale; adminId: string; replyTo?: string | null }): Promise<OutreachResult> {
  const { valid, invalid } = parseEmails(input.text);
  const batch = valid.slice(0, MAX_PER_SEND);
  const result: OutreachResult = { sent: 0, already: 0, failed: 0, invalid: invalid.length, tooMany: valid.length - batch.length };
  if (!batch.length) return result;

  const known = await db.teacherOutreach.findMany({ where: { email: { in: batch } }, select: { email: true } });
  const skip = new Set(known.map((k) => k.email));
  result.already = skip.size;

  const html = renderTeacherInviteEmail(input.locale, { sharePercent: teacherSharePercent((await getFinanceConfig()).platformShareBp) });
  for (const email of batch) {
    if (skip.has(email)) continue;
    const r = await sendMailDetailed({ to: email, subject: teacherInviteSubject(input.locale), html, replyTo: input.replyTo ?? undefined });
    if (!r.ok) {
      result.failed += 1;
      result.detail ??= r.detail.slice(0, 160);
      continue;
    }
    result.sent += 1;
    // A second tab sending the same address would hit the unique key; the mail already went, so that is not an error here.
    await db.teacherOutreach.create({ data: { email, locale: input.locale, sentById: input.adminId } }).catch(() => undefined);
  }
  return result;
}

/** The invitation to the admin's own address only. Nothing is stored and nobody else is mailed. */
export async function sendTeacherInviteTest(input: { to: string; locale: InviteLocale }): Promise<{ ok: boolean; detail: string }> {
  const html = renderTeacherInviteEmail(input.locale, { sharePercent: teacherSharePercent((await getFinanceConfig()).platformShareBp) });
  return sendMailDetailed({ to: input.to, subject: `[Test] ${teacherInviteSubject(input.locale)}`, html });
}
