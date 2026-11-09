"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { canAsk, hasLessonAccess, isCourseStaff, learnerFor, lessonScope } from "@/lib/catalog";
import { maskContacts } from "@/lib/contact-guard";
import { aiEnabled } from "@/lib/ai";
import { logAiRun } from "@/lib/ai-log";
import { askLesson, hasLessonSource, MAX_QUESTION } from "@/lib/ai-lesson";
import { db } from "@/lib/db";
import { hasGuardianConsent } from "@/lib/live";
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

/**
 * Who the progress belongs to and whether they may open the lesson. A parent watching for a child under 13 records the
 * child's progress; staff may open any lesson of their own course; everyone else needs a plan that opens it.
 */
async function lessonProgress(lessonId: string) {
  const session = await auth();
  if (!session?.user) notFound();
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { unit: { include: { course: { select: { instructorId: true } } } }, video: { select: { provider: true } } },
  });
  if (!lesson) notFound();
  const courseId = lesson.unit.courseId;
  const staff = isCourseStaff(session.user, lesson.unit.course);
  const learnerId = (await learnerFor(session.user, courseId)) ?? session.user.id;
  if (!staff && !lesson.unit.isFree && !(await hasLessonAccess(learnerId, courseId, lessonScope(lesson)))) notFound();
  return { viewerId: session.user.id, learnerId, staff, lesson };
}

async function markDone(learnerId: string, lessonId: string) {
  await db.lessonView.upsert({
    where: { userId_lessonId: { userId: learnerId, lessonId } },
    create: { userId: learnerId, lessonId, completedAt: new Date() },
    update: { completedAt: new Date(), lastSeenAt: new Date() },
  });
  revalidatePath("/[locale]/courses/[slug]/lessons/[lessonId]", "page");
  revalidatePath("/[locale]/dashboard", "page");
}

/** Marks a lesson the viewer can open as completed; used by the button under the player. */
export async function markLessonComplete(form: FormData) {
  const { lessonId } = z.object({ lessonId: z.string() }).parse(Object.fromEntries(form));
  const { learnerId } = await lessonProgress(lessonId);
  await markDone(learnerId, lessonId);
}

/**
 * Called by the VdoCipher player when the student has watched the video (end, or 90% of it). A student needs a stored
 * play of this lesson first, so the call cannot complete a lesson that was never opened. Staff previews use the button.
 */
export async function completeFromPlayer(lessonId: string) {
  const { viewerId, learnerId, staff, lesson } = await lessonProgress(lessonId);
  if (lesson.video?.provider !== "VDOCIPHER") notFound();
  if (!staff && !(await db.playEvent.count({ where: { userId: viewerId, learnerId, lessonId } }))) return;
  await markDone(learnerId, lessonId);
}

/**
 * The one-tap confidence answer after a finished lesson. Overwrites freely: it is the student's
 * current feeling, not a historical record, and it is what the readiness index reads.
 */
export async function setConfidence(form: FormData) {
  const { lessonId, confidence } = z
    .object({ lessonId: z.string(), confidence: z.enum(["GOT_IT", "SHAKY", "LOST"]) })
    .parse(Object.fromEntries(form));
  const { learnerId } = await lessonProgress(lessonId);
  await db.lessonView.upsert({
    where: { userId_lessonId: { userId: learnerId, lessonId } },
    create: { userId: learnerId, lessonId, confidence },
    update: { confidence, lastSeenAt: new Date() },
  });
  revalidatePath("/[locale]/courses/[slug]/lessons/[lessonId]", "page");
  revalidatePath("/[locale]/dashboard", "page");
}

export type AssistantState = { answer?: string; covered?: boolean; error?: "off" | "consent" | "limited" | "invalid" | "unavailable" } | null;

/**
 * "Ask about this lesson". Same access as the lesson itself, the course must have switched it on, a minor needs the
 * guardian's consent (the child's, when a parent watches), and it is capped per minute and per day. Nothing is stored.
 */
export async function askAssistant(_: AssistantState, form: FormData): Promise<AssistantState> {
  const d = z.object({ lessonId: z.string(), question: z.string().trim().min(3).max(MAX_QUESTION) }).safeParse(Object.fromEntries(form));
  if (!d.success) return { error: "invalid" };
  const { viewerId, learnerId, staff, lesson } = await lessonProgress(d.data.lessonId);
  const course = await db.course.findUniqueOrThrow({ where: { id: lesson.unit.courseId }, select: { aiAssistant: true } });
  if (!course.aiAssistant || !aiEnabled() || !hasLessonSource(lesson)) return { error: "off" };
  if (!staff && !(await hasGuardianConsent(learnerId))) return { error: "consent" };

  const minute = `lessonai:m:${viewerId}`;
  const day = `lessonai:d:${viewerId}`;
  if ((await isLimited(minute, 3, 60_000)) || (await isLimited(day, 20, DAY_MS))) return { error: "limited" };
  await Promise.all([recordAttempt(minute), recordAttempt(day)]);

  const result = await askLesson({ title: lesson.titleEn, notes: lesson.notes, pdfPages: lesson.pdfPages, question: d.data.question });
  void logAiRun({
    kind: "assistant",
    model: result?.model ?? "none",
    tokensIn: result?.usage.input,
    tokensOut: result?.usage.output,
    actorId: viewerId,
    studentId: learnerId,
    status: result ? "OK" : "ERROR",
  });
  return result ? { answer: result.answer, covered: result.covered } : { error: "unavailable" };
}
