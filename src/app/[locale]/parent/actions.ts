"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CONSENT_VERSION } from "@/lib/live-rules";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { phoneSchema } from "@/lib/schemas/auth";
import { hashToken } from "@/lib/token-utils";

/** Constant-time hash compare, so a wrong code cannot be narrowed down by response timing. */
function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * A parent links a child with the six-digit code the student generated in their account page.
 * Six digits is 1-in-a-million per guess, so the window matters: ten tries per parent per 15
 * minutes, and every failure counts — including a phone with no such student.
 */
export async function linkChild(_: unknown, form: FormData): Promise<"ok" | "not_found" | "bad_code" | "already"> {
  const session = await auth();
  if (!session?.user) notFound();
  if (session.user.role !== "PARENT") return "not_found";

  const key = `link:${session.user.id}`;
  if (await isLimited(key, 10, 15 * 60_000)) return "not_found";

  const d = z
    .object({ phone: phoneSchema, code: z.string().trim().regex(/^\d{6}$/) })
    .safeParse(Object.fromEntries(form));
  if (!d.success) {
    await recordAttempt(key);
    return "bad_code";
  }

  const student = await db.user.findUnique({ where: { phone: d.data.phone }, select: { id: true, role: true } });
  if (!student || student.role !== "STUDENT") {
    await recordAttempt(key);
    return "not_found";
  }

  const code = await db.parentCode.findUnique({ where: { studentId: student.id } });
  if (!code || code.expiresAt <= new Date() || !sameHash(code.codeHash, hashToken(d.data.code))) {
    await recordAttempt(key);
    return "bad_code";
  }

  const existing = await db.parentLink.findUnique({
    where: { parentId_studentId: { parentId: session.user.id, studentId: student.id } },
  });
  if (existing) return "already";

  await db.parentLink.create({ data: { parentId: session.user.id, studentId: student.id } });
  await db.parentCode.delete({ where: { studentId: student.id } });
  revalidatePath("/[locale]/parent", "page");
  revalidatePath("/[locale]/account", "page");
  return "ok";
}

/**
 * A linked parent consents, once, to their child joining live lectures. Only a parent account can
 * write this row, so its existence is evidence that a guardian acted. Never overwritten: the first
 * consent stands, with the wording version that was shown at the time.
 */
export async function recordChildConsent(form: FormData) {
  const session = await auth();
  if (!session?.user) notFound();
  if (session.user.role !== "PARENT") notFound();

  const studentId = z.string().min(1).parse(form.get("studentId"));
  const link = await db.parentLink.findUnique({
    where: { parentId_studentId: { parentId: session.user.id, studentId } },
    include: { parent: { select: { name: true } } },
  });
  if (!link) notFound();

  await db.guardianConsent.upsert({
    where: { studentId },
    create: {
      studentId,
      parentId: session.user.id,
      guardianName: link.parent.name,
      rulesVersion: CONSENT_VERSION,
      verifiedAt: new Date(),
    },
    // A linked parent acting in the app is verification; the first name and wording still stand.
    update: { verifiedAt: new Date() },
  });
  revalidatePath("/[locale]/parent", "page");
  revalidatePath("/[locale]/live", "layout");
}
