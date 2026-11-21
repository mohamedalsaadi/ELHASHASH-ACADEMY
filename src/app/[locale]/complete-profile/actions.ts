"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ageOn, MINOR_AGE, parseBirthDate } from "@/lib/age";
import { guardianViaWhatsApp, sendGuardianRequest } from "@/lib/guardian";
import { gradeInCountry } from "@/lib/catalog";
import { db } from "@/lib/db";
import { PRIVACY_VERSION } from "@/lib/legal";
import { profileIncomplete } from "@/lib/profile";
import { safeNext } from "@/lib/safe-redirect";
import { logEvent } from "@/lib/site-log";
import { completeProfileSchema } from "@/lib/schemas/auth";
import { hashToken, newToken } from "@/lib/token-utils";

/** Fills the fields a first Google sign-in could not collect: phone, grade, birth date and guardian. */
export async function completeProfile(form: FormData) {
  const locale = form.get("locale") === "en" ? "en" : "ar";
  const next = safeNext(form.get("next"), "");
  // Every way back to the form keeps the page the student was heading to.
  const back = (error: string) => redirect(`/${locale}/complete-profile?error=${error}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
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
  if (!profileIncomplete(user)) return redirect(next || `/${locale}/dashboard`);

  const parsed = completeProfileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue.path[0] ?? "");
    const code =
      issue.message === "too_young" || issue.message === "guardian_required" || issue.message === "invalid_birthdate" || issue.message === "terms_required"
        ? issue.message
        : field === "phone"
          ? "invalid_phone"
          : field.startsWith("guardian")
            ? "guardian_required"
            : "invalid_grade";
    // A refused form leaves no other trace; without this a student who cannot finish is invisible.
    await logEvent({ level: "WARN", source: "profile.complete", message: "Profile form refused", userId: user.id, meta: { code, field } });
    return back(code);
  }
  const d = parsed.data;
  const dob = parseBirthDate(d.dateOfBirth)!;
  if (!(await gradeInCountry(d.gradeId, d.countryId))) {
    return back("invalid_grade");
  }

  const minor = ageOn(dob) < MINOR_AGE;
  if (minor && (d.guardianPhone === d.phone || (!guardianViaWhatsApp() && !d.guardianEmail))) {
    return back("guardian_required");
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
      return back("phone_taken");
    }
    throw e;
  }

  if (minor && d.guardianPhone && token) {
    await sendGuardianRequest({ childName: user.name, guardianPhone: d.guardianPhone, guardianEmail: d.guardianEmail, token, locale });
  }

  revalidatePath("/[locale]/dashboard", "page");
  // On to the page they were heading to; otherwise the home page, which shows the student's country, grade and courses.
  redirect(next || `/${locale}`);
}
