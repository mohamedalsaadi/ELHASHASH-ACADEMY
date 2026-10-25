"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { consumeToken } from "@/lib/tokens";

export async function verifyEmail(_: unknown, form: FormData): Promise<"invalid"> {
  const locale = await getLocale();
  const token = String(form.get("token") ?? "");
  const consumed = await consumeToken(token, "VERIFY");
  if (!consumed) return "invalid";

  await db.user.update({ where: { id: consumed.userId }, data: { emailVerifiedAt: new Date() } });
  revalidatePath("/[locale]/account", "page");

  const session = await auth();
  redirect(session?.user?.id === consumed.userId ? `/${locale}/account?verified=1` : `/${locale}/signin?verified=1`);
}
