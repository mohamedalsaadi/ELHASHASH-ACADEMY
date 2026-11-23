"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** "Remind me": the daily cron emails everyone on this list on the day. Signed-in only, upcoming and not cancelled. */
export async function remindMe(form: FormData) {
  const session = await auth();
  if (!session?.user) notFound();
  const { slug } = z.object({ slug: z.string().min(1).max(120) }).parse(Object.fromEntries(form));
  const p = await db.premiere.findUnique({ where: { slug }, select: { id: true, startsAt: true, cancelledAt: true, course: { select: { published: true } } } });
  if (!p || p.cancelledAt || !p.course.published || p.startsAt <= new Date()) notFound();
  await db.premiereRsvp.upsert({
    where: { userId_premiereId: { userId: session.user.id, premiereId: p.id } },
    create: { userId: session.user.id, premiereId: p.id },
    update: {},
  });
  revalidatePath("/[locale]/premiere/[slug]", "page");
}
