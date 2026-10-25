"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { maskContacts } from "@/lib/contact-guard";
import { db } from "@/lib/db";
import { assertCourse, requireStaff } from "@/lib/staff";

/** A teacher answers (or corrects their answer to) a question on one of their own courses. */
export async function answerQuestion(form: FormData) {
  const me = await requireStaff();
  const d = z.object({ id: z.string(), answer: z.string().trim().min(1).max(4000) }).parse(Object.fromEntries(form));
  const q = await db.question.findUniqueOrThrow({ where: { id: d.id }, select: { lesson: { select: { unit: { select: { courseId: true } } } } } });
  await assertCourse(me, q.lesson.unit.courseId);
  await db.question.update({ where: { id: d.id }, data: { answer: maskContacts(d.answer).text, answeredById: me.id, answeredAt: new Date() } });
  revalidatePath("/[locale]/teacher/questions", "page");
  revalidatePath("/[locale]/courses/[slug]/lessons/[lessonId]", "page");
  revalidatePath("/[locale]/dashboard", "page");
}
