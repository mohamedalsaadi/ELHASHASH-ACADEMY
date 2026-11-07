"use server";

import bcrypt from "bcryptjs";
import { BCRYPT_COST, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/schemas/auth";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { consumeToken } from "@/lib/tokens";

export async function resetPassword(_: unknown, form: FormData): Promise<"invalid" | "short"> {
  const locale = await getLocale();
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) return "short";

  const consumed = await consumeToken(token, "RESET");
  if (!consumed) return "invalid";

  await db.user.update({ where: { id: consumed.userId }, data: { passwordHash: await bcrypt.hash(password, BCRYPT_COST), passwordChangedAt: new Date() } });
  // Any other outstanding reset links stop working once the password changes.
  await db.token.updateMany({ where: { userId: consumed.userId, kind: "RESET", usedAt: null }, data: { usedAt: new Date() } });
  redirect(`/${locale}/signin?reset=1`);
}
