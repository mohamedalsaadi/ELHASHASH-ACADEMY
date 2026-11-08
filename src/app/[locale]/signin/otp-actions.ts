"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { signIn } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { logEvent } from "@/lib/analytics";
import { ageOn, MINOR_AGE, parseBirthDate } from "@/lib/age";
import { guardianViaWhatsApp, sendGuardianRequest } from "@/lib/guardian";
import { clientIp } from "@/lib/client-ip";
import { maskContacts } from "@/lib/contact-guard";
import { db } from "@/lib/db";
import { PRIVACY_VERSION } from "@/lib/legal";
import { appUrl, emailLayout, sendMail } from "@/lib/mail";
import { checkOtp, issueOtp, readProof, signProof } from "@/lib/otp";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { safeNext } from "@/lib/safe-redirect";
import { BCRYPT_COST, otpFinishSchema, phoneSchema } from "@/lib/schemas/auth";
import { hashToken, newToken } from "@/lib/token-utils";
import { findUserByPhone } from "@/lib/user-phone";
import { sendWhatsAppCode, whatsappEnabled } from "@/lib/whatsapp";

export type OtpError =
  | "invalid_phone"
  | "too_many"
  | "send_failed"
  | "bad_code"
  | "legacy"
  | "staff"
  | "expired"
  | "taken"
  | "invalid_name"
  | "invalid_email"
  | "invalid_grade"
  | "invalid_birthdate"
  | "too_young"
  | "guardian_required"
  | "terms_required";

export type OtpState =
  | { step: "phone"; error?: OtpError; phone?: string }
  | { step: "code"; phone: string; error?: OtpError }
  | { step: "finish"; phone: string; proof: string; error?: OtpError; values?: Record<string, string | boolean> }
  | null;

const finishErrors: Record<string, OtpError> = { name: "invalid_name", email: "invalid_email", gradeId: "invalid_grade", acceptTerms: "terms_required" };

/** Where a signed-in person lands: the home page for a student (their country, grade and courses), the parent page for a parent. */
const homeFor = (role: string, locale: string, next: unknown) => safeNext(next, role === "PARENT" ? `/${locale}/parent` : `/${locale}`);

async function openSession(phone: string, role: string, locale: string, next: unknown) {
  try {
    await signIn("otp", { proof: signProof(phone), redirectTo: homeFor(role, locale, next) });
  } catch (e) {
    if (e instanceof AuthError) return "staff" as const;
    throw e; // the redirect itself
  }
  return null;
}

/**
 * One action for the three screens of phone sign-in. It never says whether a number already has an account
 * until the code has been proved, so the code request cannot be used to look numbers up.
 */
export async function otpStep(_: OtpState, form: FormData): Promise<OtpState> {
  if (!whatsappEnabled()) return { step: "phone", error: "send_failed" };
  const locale = form.get("locale") === "en" ? "en" : "ar";
  const next = form.get("next");
  const step = String(form.get("step") ?? "phone");

  if (step === "phone") {
    const phone = phoneSchema.safeParse(form.get("phone"));
    // WhatsApp needs the country code, so a local number typed under "other" is not enough.
    if (!phone.success || !phone.data.startsWith("+")) return { step: "phone", error: "invalid_phone" };
    const ip = `otp-ip:${clientIp(await headers())}`;
    const key = `otp-send:${phone.data}`;
    if ((await isLimited(key, 3, 15 * 60_000)) || (await isLimited(ip, 10, 60 * 60_000))) return { step: "phone", error: "too_many", phone: phone.data };
    await recordAttempt(key);
    await recordAttempt(ip);
    const code = await issueOtp(phone.data);
    if (!(await sendWhatsAppCode(phone.data, code, locale))) return { step: "phone", error: "send_failed", phone: phone.data };
    return { step: "code", phone: phone.data };
  }

  if (step === "code") {
    const phone = phoneSchema.safeParse(form.get("phone"));
    if (!phone.success) return { step: "phone", error: "invalid_phone" };
    const vkey = `otp-verify:${phone.data}`;
    if (await isLimited(vkey, 10, 15 * 60_000)) return { step: "code", phone: phone.data, error: "too_many" };
    await recordAttempt(vkey);
    if (!(await checkOtp(phone.data, String(form.get("code") ?? "").trim()))) return { step: "code", phone: phone.data, error: "bad_code" };

    const user = await findUserByPhone(phone.data);
    if (user) {
      if (user.deletedAt) return { step: "phone", error: "invalid_phone" };
      const failed = await openSession(phone.data, user.role, locale, next);
      return { step: "code", phone: phone.data, error: failed ?? "staff" };
    }
    // An account made before the country-code list holds the number as typed ("0501234567"), and that text fits more than one country.
    // Opening it from a code alone could open someone else's, so its owner signs in once with the password.
    const national = phone.data.replace(/^\+(971|966|965|974|973|968|20)/, "");
    if (national !== phone.data && (await db.user.count({ where: { phone: { in: [`0${national}`, national] } } })) > 0) {
      return { step: "code", phone: phone.data, error: "legacy" };
    }
    return { step: "finish", phone: phone.data, proof: signProof(phone.data) };
  }

  // finish: a new account, for the number the proof vouches for.
  const proof = String(form.get("proof") ?? "");
  const phone = readProof(proof);
  if (!phone) return { step: "phone", error: "expired" };
  const values = {
    type: String(form.get("type") ?? "STUDENT"),
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    gradeId: String(form.get("gradeId") ?? ""),
    dateOfBirth: String(form.get("dateOfBirth") ?? ""),
    guardianName: String(form.get("guardianName") ?? ""),
    guardianPhone: String(form.get("guardianPhone") ?? ""),
    guardianEmail: String(form.get("guardianEmail") ?? ""),
    guardianConsent: form.get("guardianConsent") === "on",
    acceptTerms: form.get("acceptTerms") === "on",
  };
  const here = { step: "finish" as const, phone, proof, values };
  const parsed = otpFinishSchema.safeParse(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v === "" ? undefined : v])));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const f = String(issue.path[0]);
    return { ...here, error: finishErrors[f] ?? (f === "dateOfBirth" ? (issue.message === "too_young" ? "too_young" : "invalid_birthdate") : "guardian_required") };
  }
  const d = parsed.data;
  const parent = d.type === "PARENT";
  const name = maskContacts(d.name).text;
  if (name.trim().length < 2) return { ...here, error: "invalid_name" };
  if (!parent && !(await db.grade.findUnique({ where: { id: d.gradeId! }, select: { id: true } }))) return { ...here, error: "invalid_grade" };

  const dob = !parent && d.dateOfBirth ? parseBirthDate(d.dateOfBirth) : null;
  const minor = dob !== null && ageOn(dob) < MINOR_AGE;
  if (minor && (d.guardianPhone === phone || (!guardianViaWhatsApp() && !d.guardianEmail))) return { ...here, error: "guardian_required" };
  const guardianToken = minor ? newToken() : null;
  try {
    await db.$transaction(async (trx) => {
      const created = await trx.user.create({
        data: {
          name,
          phone,
          email: d.email || null,
          gradeId: parent ? null : d.gradeId,
          role: parent ? "PARENT" : "STUDENT",
          locale,
          dateOfBirth: dob,
          termsAcceptedAt: new Date(),
          // No password: the phone is the sign-in. A random one keeps password sign-in closed until the person sets one.
          passwordHash: await bcrypt.hash(randomUUID(), BCRYPT_COST),
        },
      });
      if (minor) {
        await trx.guardianConsent.create({
          data: {
            studentId: created.id,
            parentId: null,
            guardianName: d.guardianName!,
            guardianPhone: d.guardianPhone,
            guardianEmail: d.guardianEmail ?? null,
            viaWhatsApp: guardianViaWhatsApp(),
            rulesVersion: PRIVACY_VERSION,
            source: "SIGNUP",
            verifyTokenHash: hashToken(guardianToken!),
            verifyExpiresAt: new Date(Date.now() + 7 * 86_400_000),
          },
        });
      }
      await logEvent({ name: "signup_completed", userId: created.id, props: { role: parent ? "PARENT" : "STUDENT", method: "whatsapp" } });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ...here, error: "taken" };
    throw e;
  }

  if (minor && guardianToken) {
    await sendGuardianRequest({ childName: name, guardianPhone: d.guardianPhone!, guardianEmail: d.guardianEmail, token: guardianToken, locale });
  }
  const failed = await openSession(phone, parent ? "PARENT" : "STUDENT", locale, next);
  return { ...here, error: failed ?? "taken" };
}
