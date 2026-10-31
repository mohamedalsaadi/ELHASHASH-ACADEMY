"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { signIn } from "@/auth";
import { logEvent } from "@/lib/analytics";
import { maskContacts } from "@/lib/contact-guard";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { appUrl, emailLayout, sendMail } from "@/lib/mail";
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
    | "phone_taken"
    | "email_taken"
    | "too_many";
  values?: { type: string; name: string; email: string; phone: string; gradeId: string };
} | null;

export async function signUp(_: SignUpState, form: FormData): Promise<SignUpState> {
  const values = {
    type: form.get("type") === "PARENT" ? "PARENT" : "STUDENT",
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    phone: String(form.get("phone") ?? ""),
    gradeId: String(form.get("gradeId") ?? ""),
  };
  const parsed = signUpSchema.safeParse({ ...values, password: form.get("password") });
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
              : "password_too_short";
    return { error, values };
  }
  const { email, phone, password, gradeId, type } = parsed.data;
  const isParent = type === "PARENT";
  const name = maskContacts(parsed.data.name).text;
  if (name.trim().length < 2) return { error: "invalid_name", values };
  if (!isParent && !(await db.grade.findUnique({ where: { id: gradeId! } }))) return { error: "invalid_grade", values };

  // 5 new accounts per hour per network address.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const key = `signup:${ip}`;
  if (await isLimited(key, 5, 60 * 60_000)) return { error: "too_many", values };

  const locale = form.get("locale") === "en" ? "en" : "ar";
  let userId: string;
  try {
    const user = await db.user.create({
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
    userId = user.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // meta.target is an array of columns in some drivers and absent in others; the message names the constraint.
      const target = `${String((e.meta as { target?: unknown } | undefined)?.target ?? "")} ${e.message}`.toLowerCase();
      return { error: target.includes("email") ? "email_taken" : "phone_taken", values };
    }
    throw e;
  }
  await recordAttempt(key);
  await logEvent({ name: "signup_completed", userId, props: { role: isParent ? "PARENT" : "STUDENT" } });

  const token = await issueToken(userId, "VERIFY", VERIFY_TTL);
  const ar = locale === "ar";
  await sendMail({
    to: email,
    subject: ar ? "أهلًا بك في AAcademy" : "Welcome to AAcademy",
    html: emailLayout(
      ar ? "أهلًا بك في AAcademy" : "Welcome to AAcademy",
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
