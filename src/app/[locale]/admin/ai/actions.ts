"use server";

import { revalidatePath } from "next/cache";
import { sendBriefing } from "@/lib/briefing";
import { requireAdmin } from "@/lib/staff";

/** The owner asks for the briefing now, instead of waiting for 06:00. */
export async function sendBriefingNow() {
  await requireAdmin();
  await sendBriefing(new Date(), true);
  revalidatePath("/[locale]/admin/ai", "page");
}
