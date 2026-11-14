"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ageOn, MINOR_AGE, parseBirthDate } from "@/lib/age";
import { guardianViaWhatsApp, sendGuardianRequest } from "@/lib/guardian";
import { db } from "@/lib/db";
import { PRIVACY_VERSION } from "@/lib/legal";
import { completeProfileSchema } from "@/lib/schemas/auth";
import { hashToken, newToken } from "@/lib/token-utils";

/** Fills the fields a first Google sign-in could not collect: phone, grade, birth date and guardian. */
export async function completeProfile(form: FormData) {
  const locale = form.get("locale") === "en" ? "en" : "ar";
  const session = await auth();
  if (!session?.user) return redirect(`/${locale}/signin`);
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, phone: true, gradeId: true, name: true },
  });
  if (!user) return redirect(`/${locale}/signin`);
  if (user.role !== "STUDENT") {
    const home = user.role === "PARENT" ? "parent" : user.role === "ADMIN" ? "admin" : "teacher";
    return redirect(`/${locale}/${home}`);
  }
  if (user.phone && user.gradeId) return redirect(`/${locale}/dashboard`);

  const parsed = completeProfileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const code =
      issue.message === "too_young" || issue.message === "guardian_required" || issue.message === "invalid_birthdate" || issue.message === "terms_required"
        ? issue.message
        : issue.path[0] === "phone"
          ? "invalid_phone"
          : "invalid_grade";
    return redirect(`/${locale}/complete-profile?error=${code}`);
  }
  const d = parsed.data;
  const dob = parseBirthDate(d.dateOfBirth)!;
  if (!(await db.grade.findUnique({ where: { id: d.gradeId }, select: { id: true } }))) {
    return redirect(`/${locale}/complete-profile?error=invalid_grade`);
  }

  const minor = ageOn(dob) < MINOR_AGE;
  if (minor && (d.guardianPhone === d.phone || (!guardianViaWhatsApp() && !d.guardianEmail))) {
    return redirect(`/${locale}/complete-profile?error=guardian_required`);
  }
  const token = minor ? newToken() : null;
  const tokenHash = token ? hashToken(token) : null;
  try {
    await db.$transaction(async (trx) => {
      await trx.user.update({ where: { id: user.id }, data: { phone: d.phone, phoneVerifiedAt: null, gradeId: d.gradeId, dateOfBirth: dob, termsAcceptedAt: new Date() } });
      if (minor) {
        await trx.guardianConsent.upsert({
          where: { studentId: user.id },
          create: {
            studentId: user.id,
            parentId: null,
            guardianName: d.guardianName!,
            guardianPhone: d.guardianPhone,
            guardianEmail: d.guardianEmail ?? null,
            viaWhatsApp: guardianViaWhatsApp(),
            rulesVersion: PRIVACY_VERSION,
            source: "SIGNUP",
            verifyTokenHash: tokenHash,
            verifyExpiresAt: new Date(Date.now() + 7 * 86_400_000),
          },
          // A retry gets a fresh verification link; the first guardian name and email still stand.
          update: { guardianPhone: d.guardianPhone, viaWhatsApp: guardianViaWhatsApp(), verifyTokenHash: tokenHash, verifyExpiresAt: new Date(Date.now() + 7 * 86_400_000) },
        });
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return redirect(`/${locale}/complete-profile?error=phone_taken`);
    }
    throw e;
  }

  if (minor && d.guardianPhone && token) {
    await sendGuardianRequest({ childName: user.name, guardianPhone: d.guardianPhone, guardianEmail: d.guardianEmail, token, locale });
  }

  revalidatePath("/[locale]/dashboard", "page");
  // The home page shows the student's country, grade and courses.
  redirect(`/${locale}`);
}
