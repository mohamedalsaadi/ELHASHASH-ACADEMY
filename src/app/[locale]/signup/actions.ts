"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { signIn } from "@/auth";
import { logEvent } from "@/lib/analytics";
import { ageOn, parseBirthDate } from "@/lib/age";
import { maskContacts } from "@/lib/contact-guard";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/client-ip";
import { Prisma } from "@/generated/prisma/client";
import { appUrl, emailLayout, sendMail } from "@/lib/mail";
import { PRIVACY_VERSION } from "@/lib/legal";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { hashToken, newToken } from "@/lib/token-utils";
import { issueToken, VERIFY_TTL } from "@/lib/tokens";
import { safeNext } from "@/lib/safe-redirect";
import { BCRYPT_COST, signUpSchema } from "@/lib/schemas/auth";

export type SignUpState = {
  error?:
    | "invalid_name"
    | "invalid_email"
    | "invalid_phone"
    | "password_too_short"
    | "invalid_grade"
    | "invalid_birthdate"
    | "too_young"
    | "guardian_required"
    | "terms_required"
    | "check_email"
    | "too_many";
  values?: {
    type: string;
    name: string;
    email: string;
    phone: string;
    gradeId: string;
    guardianName: string;
    guardianEmail: string;
    dateOfBirth: string;
    guardianConsent: boolean;
    acceptTerms: boolean;
  };
} | null;

export async function signUp(_: SignUpState, form: FormData): Promise<SignUpState> {
  const values = {
    type: form.get("type") === "PARENT" ? "PARENT" : "STUDENT",
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    phone: String(form.get("phone") ?? ""),
    gradeId: String(form.get("gradeId") ?? ""),
    guardianName: String(form.get("guardianName") ?? ""),
    guardianEmail: String(form.get("guardianEmail") ?? ""),
    dateOfBirth: String(form.get("dateOfBirth") ?? ""),
    // Returned with the error so the guardian does not have to tick it again after a typo elsewhere.
    guardianConsent: form.get("guardianConsent") === "on",
    acceptTerms: form.get("acceptTerms") === "on",
  };
  const parsed = signUpSchema.safeParse({
    ...values,
    password: form.get("password"),
    guardianConsent: form.get("guardianConsent") === "on",
    acceptTerms: form.get("acceptTerms") === "on",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path[0];
    const error =
      field === "acceptTerms"
        ? "terms_required"
        : field === "name"
        ? "invalid_name"
        : field === "email"
          ? "invalid_email"
          : field === "phone"
            ? "invalid_phone"
            : field === "gradeId"
              ? "invalid_grade"
              : field === "dateOfBirth"
                ? issue.message === "too_young"
                  ? "too_young"
                  : "invalid_birthdate"
                : field === "guardianConsent" || field === "guardianName" || field === "guardianEmail"
                  ? "guardian_required"
                  : "password_too_short";
    return { error, values };
  }
  const { email, phone, password, gradeId, type, guardianName, guardianEmail, dateOfBirth } = parsed.data;
  const isParent = type === "PARENT";
  const dob = dateOfBirth ? parseBirthDate(dateOfBirth) : null;
  const age = dob ? ageOn(dob) : null;
  const minor = age !== null && age < 18;
  const name = maskContacts(parsed.data.name).text;
  if (name.trim().length < 2) return { error: "invalid_name", values };
  if (!isParent && !(await db.grade.findUnique({ where: { id: gradeId! } }))) return { error: "invalid_grade", values };

  // The guardian token is generated before the transaction so the hash and the email share one value.
  const guardianToken = minor ? newToken() : null;
  const guardianTokenHash = guardianToken ? hashToken(guardianToken) : null;

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
          dateOfBirth: isParent ? null : dob,
          termsAcceptedAt: new Date(),
          passwordHash: await bcrypt.hash(password, BCRYPT_COST),
        },
      });
      if (!isParent && minor) {
        await trx.guardianConsent.create({
          data: {
            studentId: created.id,
            parentId: null,
            guardianName: guardianName!,
            guardianEmail: guardianEmail!,
            rulesVersion: PRIVACY_VERSION,
            source: "SIGNUP",
            verifyTokenHash: guardianTokenHash,
            verifyExpiresAt: new Date(Date.now() + 7 * 86_400_000),
          },
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
  await logEvent({ name: "signup_completed", userId, props: { role: isParent ? "PARENT" : "STUDENT", method: "password" } });

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

  if (!isParent && minor && guardianEmail && guardianToken) {
    await sendMail({
      to: guardianEmail,
      subject: ar ? "تأكيد موافقة ولي الأمر" : "Confirm your consent for a Dhirwa account",
      html: emailLayout(
        ar ? "تأكيد موافقة ولي الأمر" : "Confirm your consent",
        [
          ar
            ? `أنشأ ${name} حسابًا على ذروة بموافقتك. اضغط الرابط لتأكيد موافقتك على استخدام المنصة.`
            : `${name} created a Dhirwa account with your consent. Open the link to confirm that you agree to them using the platform.`,
        ],
        { href: `${appUrl()}/${locale}/guardian/confirm?token=${guardianToken}`, label: ar ? "تأكيد الموافقة" : "Confirm consent" },
        ar ? "ar" : "en",
      ),
    }).catch(() => {});
  }

  // A student lands on the home page ("/" shows their country, grade and courses once they are signed in).
  const target = safeNext(form.get("next"), isParent ? `/${locale}/parent` : `/${locale}`);
  await signIn("credentials", { login: phone, password, redirectTo: target });
  return null;
}
