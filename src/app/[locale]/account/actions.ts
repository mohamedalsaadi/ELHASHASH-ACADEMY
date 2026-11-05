"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { maskContacts } from "@/lib/contact-guard";
import { db } from "@/lib/db";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/schemas/auth";
import { appUrl, emailLayout, sendMail } from "@/lib/mail";
import { newCode, hashToken } from "@/lib/token-utils";
import { issueToken, VERIFY_TTL } from "@/lib/tokens";

async function me() {
  const session = await auth();
  if (!session?.user) notFound();
  return session.user;
}

async function sendVerify(userId: string, email: string, locale: string) {
  const token = await issueToken(userId, "VERIFY", VERIFY_TTL);
  const ar = locale === "ar";
  const link = `${appUrl()}/${ar ? "ar" : "en"}/verify/${token}`;
  await sendMail({
    to: email,
    subject: ar ? "أكّد بريدك الإلكتروني" : "Confirm your email",
    html: emailLayout(
      ar ? "أكّد بريدك الإلكتروني" : "Confirm your email address",
      [ar ? "اضغط الزر لتأكيد بريدك حتى تصلك الإيصالات والتنبيهات." : "Press the button to confirm your address so receipts and reminders reach you."],
      { href: link, label: ar ? "تأكيد البريد" : "Confirm email" },
      ar ? "ar" : "en",
    ),
  });
}

export async function updateProfile(_: unknown, form: FormData): Promise<"ok" | "invalid_name" | "invalid_email" | "email_taken"> {
  const user = await me();
  const d = z.object({ name: z.string().trim().min(2).max(80), email: z.email().trim().toLowerCase() }).safeParse(Object.fromEntries(form));
  if (!d.success) return d.error.issues[0].path[0] === "email" ? "invalid_email" : "invalid_name";

  const name = maskContacts(d.data.name).text;
  if (name.trim().length < 2) return "invalid_name";

  const current = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true, locale: true } });
  const changed = current.email !== d.data.email;
  try {
    await db.user.update({
      where: { id: user.id },
      data: { name, email: d.data.email, ...(changed ? { emailVerifiedAt: null } : {}) },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "email_taken";
    throw e;
  }
  if (changed) await sendVerify(user.id, d.data.email, current.locale);
  revalidatePath("/[locale]/account", "page");
  return "ok";
}

export async function changeOwnPassword(_: unknown, form: FormData): Promise<"ok" | "wrong" | "short"> {
  const user = await me();
  // A stolen session must not brute-force the current password at full speed.
  if (await isLimited(`chpw:${user.id}`, 5, 15 * 60_000)) return "wrong";
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < PASSWORD_MIN || next.length > PASSWORD_MAX) return "short";
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await bcrypt.compare(current, row.passwordHash))) {
    await recordAttempt(`chpw:${user.id}`);
    return "wrong";
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 10), passwordChangedAt: new Date() } });
  return "ok";
}

export async function sendVerification() {
  const user = await me();
  // Three per hour, so the button cannot be used to flood an inbox or burn the mail quota.
  if (await isLimited(`verify:${user.id}`, 3, 3_600_000)) return;
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true, emailVerifiedAt: true, locale: true } });
  if (row.email && !row.emailVerifiedAt) await sendVerify(user.id, row.email, row.locale);
}

/** The raw six-digit code is returned once, to show on screen; only its hash is stored. */
export async function generateParentCode(): Promise<string | null> {
  const user = await me();
  if (user.role !== "STUDENT") return null;
  const code = newCode();
  const expiresAt = new Date(Date.now() + 15 * 60_000);
  // A six-digit code hashes to a million candidates; do not keep expired rows around to be reversed.
  await db.parentCode.deleteMany({ where: { studentId: user.id, expiresAt: { lt: new Date() } } });
  await db.parentCode.upsert({
    where: { studentId: user.id },
    create: { studentId: user.id, codeHash: hashToken(code), expiresAt },
    update: { codeHash: hashToken(code), expiresAt },
  });
  return code;
}

export async function unlinkParent(form: FormData) {
  const user = await me();
  const { id } = z.object({ id: z.string() }).parse(Object.fromEntries(form));
  await db.parentLink.deleteMany({ where: { id, OR: [{ parentId: user.id }, { studentId: user.id }] } });
  revalidatePath("/[locale]/account", "page");
  revalidatePath("/[locale]/parent", "page");
}

/** A student's grade, and with it their country. What they bought is untouched. */
export async function updateGrade(form: FormData) {
  const user = await me();
  if (user.role !== "STUDENT") notFound();
  const gradeId = String(form.get("gradeId") ?? "");
  const grade = await db.grade.findFirst({ where: { id: gradeId, active: true, country: { active: true } }, select: { id: true } });
  if (!grade) return;
  await db.user.update({ where: { id: user.id }, data: { gradeId: grade.id } });
  revalidatePath("/[locale]/account", "page");
  revalidatePath("/[locale]/me", "page");
}
