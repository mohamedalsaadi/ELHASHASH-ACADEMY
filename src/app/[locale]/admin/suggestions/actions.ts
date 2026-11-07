"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/staff";
import { summariseNewSuggestions } from "@/lib/suggestions";

/** Reads the notes no summary has covered yet, in the language of the page the owner is on. */
export async function summarise(form: FormData) {
  await requireAdmin();
  const locale = form.get("locale") === "en" ? "en" : "ar";
  const digest = await summariseNewSuggestions(locale);
  revalidatePath("/[locale]/admin/suggestions", "page");
  redirect(`/${locale}/admin/suggestions${digest ? "" : "?failed=1"}`);
}
