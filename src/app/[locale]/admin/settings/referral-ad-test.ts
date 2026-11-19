"use server";

import { db } from "@/lib/db";
import { appUrl, sendMailDetailed } from "@/lib/mail";
import { renderReferralAdEmail, referralAdSubject } from "@/lib/referral-ad-email";
import { requireAdmin } from "@/lib/staff";
import { unsubscribeUrl } from "@/lib/unsubscribe";

/** Sends the invite-a-friend email, Arabic then English, to the signed-in admin only. Nobody else is mailed. */
export async function sendReferralAdTest(): Promise<{ ok: boolean; detail: string; to: string }> {
  const me = await requireAdmin();
  const [user, setting] = await Promise.all([
    db.user.findUnique({ where: { id: me.id }, select: { email: true } }),
    db.platformSetting.findUnique({ where: { id: "singleton" }, select: { referralRewardPercentOff: true } }),
  ]);
  if (!user?.email) return { ok: false, detail: "Your account has no email address", to: "" };
  const percent = setting?.referralRewardPercentOff ?? 0;
  if (percent <= 0) return { ok: false, detail: "The referral reward is 0, so there is nothing to advertise", to: user.email };
  const unsubscribe = unsubscribeUrl(appUrl(), me.id);
  const ids: string[] = [];
  for (const locale of ["ar", "en"] as const) {
    const r = await sendMailDetailed({
      to: user.email,
      subject: `${locale === "ar" ? "[AR] " : "[EN] "}${referralAdSubject(locale, percent)}`,
      html: renderReferralAdEmail(locale, { percent, unsubscribe }),
      unsubscribe,
    });
    if (!r.ok) return { ok: false, detail: r.detail, to: user.email };
    ids.push(r.detail);
  }
  return { ok: true, detail: ids.join(", "), to: user.email };
}
