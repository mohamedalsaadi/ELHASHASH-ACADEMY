"use server";

import { revalidatePath } from "next/cache";
import { sendBriefing } from "@/lib/briefing";
import { report } from "@/lib/sentry";
import { db } from "@/lib/db";
import { realDeps, tick } from "@/lib/coworker/engine";
import { githubConfigured } from "@/lib/coworker/github";
import { logEvent } from "@/lib/site-log";
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

/** Pauses or resumes Sentinel. The change is written to the site log with who made it. */
export async function setCoworkerPaused(form: FormData) {
  const admin = await requireAdmin();
  const paused = form.get("paused") === "1";
  await db.coworkerControl.upsert({ where: { id: "singleton" }, create: { id: "singleton", paused, updatedById: admin.id }, update: { paused, updatedById: admin.id } });
  await logEvent({ source: "coworker.control", message: paused ? "paused by an admin" : "resumed by an admin", userId: admin.id });
  revalidatePath("/[locale]/admin/ai", "page");
}

/** Turns Sentinel's auto-merge on or off. Off is shadow mode: it opens pull requests and never merges. */
export async function setCoworkerAutoMerge(form: FormData) {
  const admin = await requireAdmin();
  const autoMerge = form.get("autoMerge") === "1";
  await db.coworkerControl.upsert({ where: { id: "singleton" }, create: { id: "singleton", autoMerge, updatedById: admin.id }, update: { autoMerge, updatedById: admin.id } });
  await logEvent({ source: "coworker.control", message: autoMerge ? "auto-merge turned ON by an admin" : "auto-merge turned off by an admin", userId: admin.id });
  revalidatePath("/[locale]/admin/ai", "page");
}

/** One Sentinel run now, instead of waiting for the next 30-minute tick. */
export async function runCoworkerNow() {
  await requireAdmin();
  if (githubConfigured()) await tick(realDeps());
  revalidatePath("/[locale]/admin/ai", "page");
}
