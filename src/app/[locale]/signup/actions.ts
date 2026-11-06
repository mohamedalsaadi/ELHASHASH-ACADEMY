"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { signIn } from "@/auth";
import { logEvent } from "@/lib/analytics";
import { maskContacts } from "@/lib/contact-guard";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/client-ip";
import { Prisma } from "@/generated/prisma/client";
import { appUrl, emailLayout, sendMail } from "@/lib/mail";
import { PRIVACY_VERSION } from "@/lib/legal";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { issueToken, VERIFY_TTL } from "@/lib/tokens";
import { safeNext } from "@/lib/safe-redirect";
import { signUpSchema } from "@/lib/schemas/auth";

export type SignUpState = {
  error?:
    | "invalid_name"
    | "invalid_email"
    | "invalid_phone"
    | "password_too_short"
    | "invalid_grade"
    | "guardian_required"
    | "check_email"
    | "too_many";
  values?: { type: string; name: string; email: string; phone: string; gradeId: string; guardianName: string; guardianConsent: boolean };
} | null;

export async function signUp(_: SignUpState, form: FormData): Promise<SignUpState> {
  const values = {
    type: form.get("type") === "PARENT" ? "PARENT" : "STUDENT",
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    phone: String(form.get("phone") ?? ""),
    gradeId: String(form.get("gradeId") ?? ""),
    guardianName: String(form.get("guardianName") ?? ""),
    // Returned with the error so the guardian does not have to tick it again after a typo elsewhere.
    guardianConsent: form.get("guardianConsent") === "on",
  };
  const parsed = signUpSchema.safeParse({
    ...values,
    password: form.get("password"),
    guardianConsent: form.get("guardianConsent") === "on",
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0].path[0];
    const error =
      field === "name"
        ? "invalid_name"
        : field === "email"
          ? "invalid_email"
          : field === "phone"
            ? "invalid_phone"
            : field === "gradeId"
              ? "invalid_grade"
              : field === "guardianConsent" || field === "guardianName"
                ? "guardian_required"
                : "password_too_short";
    return { error, values };
  }
  const { email, phone, password, gradeId, type, guardianName } = parsed.data;
  const isParent = type === "PARENT";
  const name = maskContacts(parsed.data.name).text;
  if (name.trim().length < 2) return { error: "invalid_name", values };
  if (!isParent && !(await db.grade.findUnique({ where: { id: gradeId! } }))) return { error: "invalid_grade", values };

  // 5 new accounts per hour per network address.
  const ip = clientIp(await headers());
  const key = `signup:${ip}`;
  if (await isLimited(key, 5, 60 * 60_000)) return { error: "too_many", values };

  const locale = form.get("locale") === "en" ? "en" : "ar";
  let userId: string;
  try {
    // The account and its guardian consent land together, so a student is never left without a record.
    const user = await db.$transaction(async (trx) => {
      const created = await trx.user.create({
        data: {
          name,
          email,
          phone,
          gradeId: isParent ? null : gradeId,
          role: isParent ? "PARENT" : "STUDENT",
          locale,
          passwordHash: await bcrypt.hash(password, 10),
        },
      });
      if (!isParent) {
        await trx.guardianConsent.create({
          data: { studentId: created.id, parentId: null, guardianName: guardianName!, rulesVersion: PRIVACY_VERSION, source: "SIGNUP" },
        });
      }
      return created;
    });
    userId = user.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // Never say which field was taken: that is an account-enumeration oracle. Tell the address
      // that was typed, and answer the form the same way a new signup would be answered.
      const ar = form.get("locale") === "en" ? false : true;
      await sendMail({
        to: email,
        subject: ar ? "لديك حساب في ذروة" : "You already have a Dhirwa account",
        html: emailLayout(
          ar ? "لديك حساب في ذروة" : "You already have a Dhirwa account",
          [ar ? "سجّل الدخول، أو استخدم «نسيت كلمة المرور» إن لم تتذكرها." : "Sign in, or use \"Forgot password\" if you do not remember it."],
          { href: `${appUrl()}/${ar ? "ar" : "en"}/signin`, label: ar ? "تسجيل الدخول" : "Sign in" },
          ar ? "ar" : "en",
        ),
      }).catch(() => {});
      return { error: "check_email", values };
    }
    throw e;
  }
  await recordAttempt(key);
  await logEvent({ name: "signup_completed", userId, props: { role: isParent ? "PARENT" : "STUDENT" } });

  const token = await issueToken(userId, "VERIFY", VERIFY_TTL);
  const ar = locale === "ar";
  await sendMail({
    to: email,
    subject: ar ? "أهلًا بك في ذروة" : "Welcome to Dhirwa",
    html: emailLayout(
      ar ? "أهلًا بك في ذروة" : "Welcome to Dhirwa",
      [
        ar ? "تم إنشاء حسابك. أكّد بريدك حتى تصلك الإيصالات وتنبيهات الدروس." : "Your account is ready. Confirm your email so receipts and lesson updates reach you.",
      ],
      { href: `${appUrl()}/${locale}/verify/${token}`, label: ar ? "تأكيد البريد" : "Confirm email" },
      ar ? "ar" : "en",
    ),
  });

  const target = safeNext(form.get("next"), `/${locale}/${isParent ? "parent" : "courses"}`);
  await signIn("credentials", { login: phone, password, redirectTo: target });
  return null;
}
