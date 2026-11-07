"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { RIDE_COUNTRY } from "@/lib/student-home";

/** Remembers the country the student chose for their home, for a year. */
export async function setCountry(form: FormData) {
  const { id } = z.object({ id: z.string().min(1) }).parse(Object.fromEntries(form));
  if (!(await db.country.count({ where: { id, active: true } }))) return;
  (await cookies()).set(RIDE_COUNTRY, id, {
    path: "/",
    maxAge: 31_536_000,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/[locale]/me", "page");
}

/** Forgets it, so the home asks for the country again. */
export async function clearCountry() {
  (await cookies()).delete(RIDE_COUNTRY);
  revalidatePath("/[locale]/me", "page");
}
