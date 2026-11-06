"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { phoneSchema } from "@/lib/schemas/auth";

export type StudentLookup = { ok: true; name: string } | { ok: false; reason: "invalid" | "not_found" | "too_many" };

/** Enough to confirm the right child without handing a parent the student's full profile. */
function maskedName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

/**
 * Confirms the student a parent typed the phone for, before any money moves. The lookup is a
 * convenience, not authority: the checkout route resolves the phone again and refuses an unknown one.
 */
export async function lookupStudent(rawPhone: string): Promise<StudentLookup> {
  const session = await auth();
  if (!session?.user || session.user.role !== "PARENT") return { ok: false, reason: "invalid" };

  // Twenty lookups an hour is enough for a parent correcting a typo, and too few to enumerate phones.
  const key = `lookup:${session.user.id}`;
  if (await isLimited(key, 20, 3_600_000)) return { ok: false, reason: "too_many" };
  await recordAttempt(key);

  const parsed = phoneSchema.safeParse(rawPhone);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  const student = await db.user.findUnique({
    where: { phone: parsed.data },
    select: { id: true, role: true, name: true },
  });
  if (!student || student.role !== "STUDENT" || student.id === session.user.id) return { ok: false, reason: "not_found" };
  return { ok: true, name: maskedName(student.name) };
}
