"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { canAsk, lessonScope } from "@/lib/catalog";
import { maskContacts } from "@/lib/contact-guard";
import { db } from "@/lib/db";
import { isLimited, recordAttempt } from "@/lib/rate-limit";

const DAY_MS = 86_400_000;

/** A student's question under a lecture: monthly and semester subscribers only, 5 a day. */
export async function askQuestion(_: unknown, form: FormData): Promise<"ok" | "masked" | "limited" | "invalid"> {
  const session = await auth();
  if (!session?.user) notFound();
  const d = z.object({ lessonId: z.string(), body: z.string().trim().min(3).max(1500) }).safeParse(Object.fromEntries(form));
  if (!d.success) return "invalid";
  const lesson = await db.lesson.findUnique({ where: { id: d.data.lessonId }, include: { unit: true } });
  if (!lesson || !(await canAsk(session.user.id, lesson.unit.courseId, lessonScope(lesson)))) notFound();

  const key = `ask:${session.user.id}`;
  if (await isLimited(key, 5, DAY_MS)) return "limited";
  await recordAttempt(key);
  const scan = maskContacts(d.data.body);
  await db.question.create({ data: { userId: session.user.id, lessonId: lesson.id, body: scan.text } });
  revalidatePath("/[locale]/courses/[slug]/lessons/[lessonId]", "page");
  revalidatePath("/[locale]/teacher/questions", "page");
  return scan.masked ? "masked" : "ok";
}
