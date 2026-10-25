"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function markAllRead() {
  const session = await auth();
  if (!session?.user) notFound();
  await db.notification.updateMany({ where: { userId: session.user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/[locale]/notifications", "page");
  revalidatePath("/[locale]", "layout");
}

/** Marks one notification read before opening its internal target. */
export async function openNotification(form: FormData) {
  const session = await auth();
  if (!session?.user) notFound();
  const { id } = z.object({ id: z.string() }).parse(Object.fromEntries(form));
  const notification = await db.notification.findFirst({ where: { id, userId: session.user.id }, select: { href: true } });
  if (!notification) notFound();
  await db.notification.updateMany({ where: { id, userId: session.user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/[locale]/notifications", "page");
  revalidatePath("/[locale]", "layout");
  const locale = await getLocale();
  redirect(notification.href?.startsWith("/") ? `/${locale}${notification.href}` : `/${locale}/notifications`);
}
