"use server";

import { revalidatePath } from "next/cache";
import { sendBriefing } from "@/lib/briefing";
import { report } from "@/lib/sentry";
import { requireAdmin } from "@/lib/staff";

/** The owner asks for the briefing now, instead of waiting for 06:00. */
export async function sendBriefingNow() {
  await requireAdmin();
  await sendBriefing(new Date(), true);
  revalidatePath("/[locale]/admin/ai", "page");
}

/** Sends one harmless test error, so the owner can see it arrive in Sentry. */
export async function sendSentryTest() {
  await requireAdmin();
  await report(new Error("Test error from the owner desk (safe to ignore)"), { kind: "test", route: "/admin/ai" });
}
