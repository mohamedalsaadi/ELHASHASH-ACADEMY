"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function markAllRead() {
  const session = await auth();
  if (!session?.user) notFound();
  await db.notification.updateMany({ where: { userId: session.user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/[locale]/notifications", "page");
  revalidatePath("/[locale]", "layout");
}
