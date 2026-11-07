"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ageOn, parseBirthDate } from "@/lib/age";
import { db } from "@/lib/db";
import { PRIVACY_VERSION } from "@/lib/legal";
import { appUrl, emailLayout, sendMail } from "@/lib/mail";
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

  const minor = ageOn(dob) < 18;
  const token = minor ? newToken() : null;
  const tokenHash = token ? hashToken(token) : null;
  try {
    await db.$transaction(async (trx) => {
      await trx.user.update({ where: { id: user.id }, data: { phone: d.phone, gradeId: d.gradeId, dateOfBirth: dob, termsAcceptedAt: new Date() } });
      if (minor) {
        await trx.guardianConsent.upsert({
          where: { studentId: user.id },
          create: {
            studentId: user.id,
            parentId: null,
            guardianName: d.guardianName!,
            guardianEmail: d.guardianEmail!,
            rulesVersion: PRIVACY_VERSION,
            source: "SIGNUP",
            verifyTokenHash: tokenHash,
            verifyExpiresAt: new Date(Date.now() + 7 * 86_400_000),
          },
          // A retry gets a fresh verification link; the first guardian name and email still stand.
          update: { verifyTokenHash: tokenHash, verifyExpiresAt: new Date(Date.now() + 7 * 86_400_000) },
        });
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return redirect(`/${locale}/complete-profile?error=phone_taken`);
    }
    throw e;
  }

  if (minor && d.guardianEmail && token) {
    const ar = locale === "ar";
    await sendMail({
      to: d.guardianEmail,
      subject: ar ? "تأكيد موافقة ولي الأمر" : "Confirm your consent for a Dhirwa account",
      html: emailLayout(
        ar ? "تأكيد موافقة ولي الأمر" : "Confirm your consent",
        [
          ar
            ? `أنشأ ${user.name} حسابًا على ذروة بموافقتك. اضغط الرابط لتأكيد موافقتك على استخدام المنصة.`
            : `${user.name} created a Dhirwa account with your consent. Open the link to confirm that you agree to them using the platform.`,
        ],
        { href: `${appUrl()}/${locale}/guardian/confirm?token=${token}`, label: ar ? "تأكيد الموافقة" : "Confirm consent" },
        ar ? "ar" : "en",
      ),
    }).catch(() => {});
  }

  revalidatePath("/[locale]/dashboard", "page");
  // The home page shows the student's country, grade and courses.
  redirect(`/${locale}`);
}
