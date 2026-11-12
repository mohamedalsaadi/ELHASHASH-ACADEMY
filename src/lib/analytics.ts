// Server-side behaviour events. A closed set of names keeps volume small and the funnel honest;
// there is deliberately no generic page-view event and no client tag.

import { cookies } from "next/headers";
import { after } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { DEVICE_COOKIE } from "@/lib/device";

export type EventName =
  | "signup_viewed"
  | "signup_completed"
  | "course_viewed"
  | "lesson_opened"
  | "checkout_started"
  | "order_paid"
  | "live_joined"
  | "course_created"
  | "course_published"
  | "invite_accepted"
  | "external_quiz_open";

export type EventInput = {
  name: EventName;
  userId?: string | null;
  courseId?: string | null;
  props?: Prisma.InputJsonValue;
  /** One insert per key, e.g. per actor, course and day. */
  dedupeKey?: string | null;
  /** Shortcut: dedupe once per actor, this scope and today. */
  dedupeScope?: string;
  sessionId?: string | null;
};

/** ISO day, for per-day dedupe keys. */
export const today = () => new Date().toISOString().slice(0, 10);

/** Who did this: the signed-in user, else the browser's device id, else nothing. */
export const actorKey = (userId?: string | null, sessionId?: string | null) => userId ?? sessionId ?? null;

export async function logEvent(input: EventInput) {
  const key =
    input.dedupeKey ??
    (input.dedupeScope ? dedupeKey(input.name, actorKey(input.userId, input.sessionId), input.dedupeScope) : null);
  try {
    await db.analyticsEvent.create({
      data: {
        name: input.name,
        userId: input.userId ?? null,
        sessionId: input.sessionId ?? null,
        courseId: input.courseId ?? null,
        props: input.props,
        dedupeKey: key,
      },
    });
  } catch (e) {
    // A repeat of the same dedupe key is expected, not an error.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return;
    console.error("[analytics]", input.name, e);
  }
}

/**
 * Reads the device cookie now (it is not available once the request ends) and writes the event
 * after the response, so tracking never delays a page.
 */
export async function logEventLater(input: EventInput) {
  let sessionId: string | null = null;
  try {
    sessionId = (await cookies()).get(DEVICE_COOKIE)?.value ?? null;
  } catch {
    // Outside a request scope; the event still records userId and course.
  }
  after(() => logEvent({ ...input, sessionId }));
}

export function dedupeKey(name: EventName, actor: string | null, scope: string) {
  return actor ? `evt:${name}:${actor}:${scope}:${today()}` : null;
}

/**
 * Deletes behavioural events past the window the privacy policy states. Called by the daily
 * retention cron; the policy and the number here must move together.
 */
export async function purgeOldAnalytics(days = 180) {
  const before = new Date(Date.now() - days * 86_400_000);
  return (await db.analyticsEvent.deleteMany({ where: { createdAt: { lt: before } } })).count;
}
