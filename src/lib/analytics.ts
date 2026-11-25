// Server-side behaviour events. A closed set of names keeps volume small and the funnel honest;
// there is deliberately no generic page-view event and no client tag.

import { logError } from "@/lib/log-error";
import { cookies } from "next/headers";
import { after } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { DEVICE_COOKIE } from "@/lib/device";
import { SRC_COOKIE, withSrc } from "@/lib/src-tag";

export type EventName =
  | "signup_viewed"
  | "signup_completed"
  | "course_viewed"
  | "lesson_opened"
  | "checkout_started"
  | "order_paid"
  | "live_joined"
  | "premiere_viewed"
  | "premiere_joined"
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
    await logError("analytics.write", e, { message: `event ${input.name} not saved`, level: "WARN", sample: 600_000 });
  }
}

/**
 * Reads the device cookie now (it is not available once the request ends) and writes the event
 * after the response, so tracking never delays a page.
 */
export async function logEventLater(input: EventInput) {
  let sessionId: string | null = null;
  let src: string | null = null;
  try {
    const jar = await cookies();
    sessionId = jar.get(DEVICE_COOKIE)?.value ?? null;
    src = jar.get(SRC_COOKIE)?.value ?? null;
  } catch {
    // Outside a request scope; the event still records userId and course.
  }
  after(() => logEvent({ ...input, sessionId, props: withSrc(input.props, src) }));
}

/**
 * The visitor's latest ad tag (lib/src-tag.ts). Call it only where the visitor's own browser made the request
 * (sign-up, checkout), never in a webhook or an admin action, where the cookie belongs to someone else.
 */
export async function currentSrc(): Promise<string | null> {
  try {
    return (await cookies()).get(SRC_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export type SourceFunnelRow = { src: string; opened: number; signedUp: number; paid: number };

/**
 * Per ad tag: people who opened the sign-up page, accounts made, and of those accounts how many have a paid order
 * with money in it (free-code orders do not count). A person counts under the tag they signed up with.
 */
export async function sourceFunnel(): Promise<SourceFunnelRow[]> {
  const [opened, accounts] = await Promise.all([
    db.$queryRaw<{ src: string; n: bigint }[]>`
      SELECT COALESCE(NULLIF(props->>'src', ''), 'untagged') AS src, count(DISTINCT COALESCE("userId", "sessionId")) AS n
        FROM "AnalyticsEvent" WHERE name = 'signup_viewed' GROUP BY 1`,
    db.$queryRaw<{ src: string; n: bigint; paid: bigint }[]>`
      WITH s AS (
        SELECT DISTINCT ON ("userId") "userId", COALESCE(NULLIF(props->>'src', ''), 'untagged') AS src
          FROM "AnalyticsEvent" WHERE name = 'signup_completed' AND "userId" IS NOT NULL
         ORDER BY "userId", "createdAt")
      SELECT src, count(*) AS n,
             count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Order" o WHERE o."userId" = s."userId" AND o.status = 'PAID' AND o.total > 0)) AS paid
        FROM s GROUP BY 1`,
  ]);
  const rows = new Map<string, SourceFunnelRow>();
  const row = (src: string) => rows.get(src) ?? rows.set(src, { src, opened: 0, signedUp: 0, paid: 0 }).get(src)!;
  for (const r of opened) row(r.src).opened = Number(r.n);
  for (const r of accounts) Object.assign(row(r.src), { signedUp: Number(r.n), paid: Number(r.paid) });
  return [...rows.values()].sort((a, b) => b.signedUp - a.signedUp || b.opened - a.opened);
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
