"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { parseBirthDate } from "@/lib/age";
import { db } from "@/lib/db";

/** An existing student can add a birth date from the dashboard without losing access. */
export async function saveDateOfBirth(form: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") notFound();
  const dob = parseBirthDate(String(form.get("dateOfBirth") ?? ""));
  if (!dob) return;
  await db.user.update({ where: { id: session.user.id }, data: { dateOfBirth: dob } });
  revalidatePath("/[locale]/dashboard", "page");
}
