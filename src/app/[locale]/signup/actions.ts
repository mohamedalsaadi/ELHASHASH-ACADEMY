"use server";

import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { signUpSchema } from "@/lib/schemas/auth";

export type SignUpState = {
  error?: "invalid_name" | "invalid_phone" | "password_too_short" | "invalid_grade" | "phone_taken";
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

  const locale = form.get("locale") === "en" ? "en" : "ar";
  try {
    await db.user.create({ data: { name, phone, gradeId, locale, passwordHash: await bcrypt.hash(password, 10) } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "phone_taken", values };
    throw e;
  }
  // Same-site paths only, as on the sign-in page.
  const next = String(form.get("next") ?? "");
  const target = next.startsWith("/") && !next.startsWith("//") ? next : `/${locale}/courses`;
  await signIn("credentials", { login: phone, password, redirectTo: target });
  return null;
}
