"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { phoneSchema } from "@/lib/schemas/auth";
import { hashToken } from "@/lib/token-utils";

/** A parent links a child with the six-digit code the student generated in their account page. */
export async function linkChild(_: unknown, form: FormData): Promise<"ok" | "not_found" | "bad_code" | "already"> {
  const session = await auth();
  if (!session?.user) notFound();
  if (session.user.role !== "PARENT") return "not_found";

  const d = z
    .object({ phone: phoneSchema, code: z.string().trim().regex(/^\d{6}$/) })
    .safeParse(Object.fromEntries(form));
  if (!d.success) return "bad_code";

  const student = await db.user.findUnique({ where: { phone: d.data.phone }, select: { id: true, role: true } });
  if (!student || student.role !== "STUDENT") return "not_found";

  const code = await db.parentCode.findUnique({ where: { studentId: student.id } });
  if (!code || code.expiresAt <= new Date() || code.codeHash !== hashToken(d.data.code)) return "bad_code";

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
