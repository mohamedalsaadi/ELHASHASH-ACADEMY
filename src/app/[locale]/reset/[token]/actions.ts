"use server";

import bcrypt from "bcryptjs";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { consumeToken } from "@/lib/tokens";

export async function resetPassword(_: unknown, form: FormData): Promise<"invalid" | "short"> {
  const locale = await getLocale();
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return "short";

  const consumed = await consumeToken(token, "RESET");
  if (!consumed) return "invalid";

  await db.user.update({ where: { id: consumed.userId }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  // Any other outstanding reset links stop working once the password changes.
  await db.token.updateMany({ where: { userId: consumed.userId, kind: "RESET", usedAt: null }, data: { usedAt: new Date() } });
  redirect(`/${locale}/signin?reset=1`);
}
