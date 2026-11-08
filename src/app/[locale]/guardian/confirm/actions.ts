"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { signProof } from "@/lib/otp";
import { BCRYPT_COST } from "@/lib/schemas/auth";
import { hashToken } from "@/lib/token-utils";
import { findUserByPhone } from "@/lib/user-phone";

/**
 * The guardian pressed "approve" on the page their link opens. This is a button, not the link itself, because
 * WhatsApp and mail apps fetch links to build previews and that must not approve anything.
 *
 * Sent by WhatsApp, the link proves the guardian holds that number, so approving also creates (or finds) their parent
 * account, links the child, and signs them in. Sent by email (WhatsApp off), only the consent is recorded.
 */
export async function approveGuardian(form: FormData) {
  const locale = form.get("locale") === "en" ? "en" : "ar";
  const token = String(form.get("token") ?? "");
  const back = `/${locale}/guardian/confirm?token=${encodeURIComponent(token)}`;
  const consent = token
    ? await db.guardianConsent.findUnique({ where: { verifyTokenHash: hashToken(token) } })
    : null;
  if (!consent || consent.verifiedAt || !consent.verifyExpiresAt || consent.verifyExpiresAt <= new Date()) return redirect(back);

  let parentPhone: string | null = null;
  if (consent.viaWhatsApp && consent.guardianPhone) {
    let parent = await findUserByPhone(consent.guardianPhone);
    // A number that already belongs to a student or a teacher cannot become someone's parent account.
    if (parent && (parent.role !== "PARENT" || parent.deletedAt)) return redirect(back);
    if (!parent) {
      try {
        parent = await db.user.create({
          data: {
            name: consent.guardianName,
            phone: consent.guardianPhone,
            role: "PARENT",
            locale,
            termsAcceptedAt: new Date(),
            // No password: the phone is the sign-in.
            passwordHash: await bcrypt.hash(randomUUID(), BCRYPT_COST),
          },
        });
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
        parent = await findUserByPhone(consent.guardianPhone);
        if (!parent || parent.role !== "PARENT") return redirect(back);
      }
    }
    const parentId = parent.id;
    await db.$transaction([
      db.guardianConsent.update({
        where: { studentId: consent.studentId },
        data: { parentId, verifiedAt: new Date(), verifyTokenHash: null, verifyExpiresAt: null },
      }),
      db.parentLink.upsert({
        where: { parentId_studentId: { parentId, studentId: consent.studentId } },
        create: { parentId, studentId: consent.studentId },
        update: {},
      }),
    ]);
    parentPhone = parent.phone;
  } else {
    await db.guardianConsent.update({
      where: { studentId: consent.studentId },
      data: { verifiedAt: new Date(), verifyTokenHash: null, verifyExpiresAt: null },
    });
  }

  if (parentPhone) {
    try {
      await signIn("otp", { proof: signProof(parentPhone), redirectTo: `/${locale}/parent` });
    } catch (e) {
      if (!(e instanceof AuthError)) throw e; // the redirect itself
    }
  }
  return redirect(`/${locale}/guardian/confirm?done=1`);
}
