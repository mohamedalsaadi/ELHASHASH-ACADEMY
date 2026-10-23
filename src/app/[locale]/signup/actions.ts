"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { signIn } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { safeNext } from "@/lib/safe-redirect";
import { signUpSchema } from "@/lib/schemas/auth";

export type SignUpState = {
  error?: "invalid_name" | "invalid_phone" | "password_too_short" | "invalid_grade" | "phone_taken" | "too_many";
  values?: { name: string; phone: string; gradeId: string };
} | null;

export async function signUp(_: SignUpState, form: FormData): Promise<SignUpState> {
  const values = {
    name: String(form.get("name") ?? ""),
    phone: String(form.get("phone") ?? ""),
    gradeId: String(form.get("gradeId") ?? ""),
  };
  const parsed = signUpSchema.safeParse({ ...values, password: form.get("password") });
  if (!parsed.success) {
    const field = parsed.error.issues[0].path[0];
    const error = field === "name" ? "invalid_name" : field === "phone" ? "invalid_phone" : field === "gradeId" ? "invalid_grade" : "password_too_short";
    return { error, values };
  }
  const { name, phone, password, gradeId } = parsed.data;
  if (!(await db.grade.findUnique({ where: { id: gradeId } }))) return { error: "invalid_grade", values };

  // 5 new accounts per hour per network address.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const key = `signup:${ip}`;
  if (await isLimited(key, 5, 60 * 60_000)) return { error: "too_many", values };

  const locale = form.get("locale") === "en" ? "en" : "ar";
  try {
    await db.user.create({ data: { name, phone, gradeId, locale, passwordHash: await bcrypt.hash(password, 10) } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "phone_taken", values };
    throw e;
  }
  await recordAttempt(key);
  const target = safeNext(form.get("next"), `/${locale}/courses`);
  await signIn("credentials", { login: phone, password, redirectTo: target });
  return null;
}
