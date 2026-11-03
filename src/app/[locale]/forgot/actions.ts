"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { appUrl, emailLayout, sendMail } from "@/lib/mail";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { issueToken, RESET_TTL } from "@/lib/tokens";

/** Always answers the same, so the form cannot be used to discover which emails have accounts. */
export async function requestReset(_: unknown, form: FormData): Promise<"ok"> {
  const d = z.object({ email: z.email().trim().toLowerCase() }).safeParse(Object.fromEntries(form));
  if (!d.success) return "ok";

  const key = `forgot:${d.data.email}`;
  if (await isLimited(key, 5, 3_600_000)) {
    console.info("[mail] reset not sent: rate limited");
    return "ok";
  }
  await recordAttempt(key);

  const user = await db.user.findUnique({ where: { email: d.data.email }, select: { id: true, email: true, locale: true } });
  if (!user?.email) console.info("[mail] reset not sent: no account with this email");
  if (user?.email) {
    const token = await issueToken(user.id, "RESET", RESET_TTL);
    const ar = user.locale === "ar";
    const link = `${appUrl()}/${ar ? "ar" : "en"}/reset/${token}`;
    await sendMail({
      to: user.email,
      subject: ar ? "إعادة تعيين كلمة المرور" : "Reset your password",
      html: emailLayout(
        ar ? "إعادة تعيين كلمة المرور" : "Reset your password",
        [ar ? "اضغط الزر لاختيار كلمة مرور جديدة. الرابط صالح 30 دقيقة ولمرة واحدة." : "Press the button to choose a new password. The link is valid for 30 minutes and once."],
        { href: link, label: ar ? "اختيار كلمة مرور جديدة" : "Choose a new password" },
        ar ? "ar" : "en",
      ),
    });
  }
  return "ok";
}
