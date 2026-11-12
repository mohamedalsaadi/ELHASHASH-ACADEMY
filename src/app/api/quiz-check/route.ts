import { opensAssignment } from "@/lib/assignments";
import { grantsFor } from "@/lib/catalog";
import { db } from "@/lib/db";
import { hasStudentToken, isCheckKey, studentForCode } from "@/lib/external-link";

export const dynamic = "force-dynamic";

/**
 * Called by the teacher's Google Form script for each answer. The assignment's own key (derived from the server secret) is the
 * only credential, so without it there is nothing to ask: a wrong key or an unknown assignment gets a plain 404.
 * Answers: ok (a subscriber who may open the quiz), not subscribed (the code is a student's but the plan has lapsed), invalid.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { assignment?: unknown; key?: unknown; code?: unknown } | null;
  const { assignment, key, code } = body ?? {};
  if (typeof assignment !== "string" || typeof key !== "string" || typeof code !== "string" || !isCheckKey(assignment, key)) return new Response(null, { status: 404 });

  const a = await db.assignment.findUnique({
    where: { id: assignment },
    select: { id: true, courseId: true, linkUrl: true, linkEntry: true, lesson: { select: { id: true, month: true, unit: { select: { term: true, isFree: true } } } } },
  });
  if (!a?.linkUrl || !(a.linkEntry || hasStudentToken(a.linkUrl))) return new Response(null, { status: 404 });

  const holders = await db.entitlement.findMany({ where: { courseId: a.courseId }, distinct: ["userId"], select: { userId: true, user: { select: { name: true } } }, take: 3000 });
  const found = studentForCode(code.slice(0, 20), a.id, holders.map((h) => h.userId));
  const reply = (data: { status: string; name?: string }) => Response.json(data, { headers: { "Cache-Control": "no-store" } });
  if (!found) return reply({ status: "invalid" });

  const now = new Date();
  const open = opensAssignment(a, await grantsFor(found, a.courseId, now), now);
  return reply({ status: open ? "ok" : "not subscribed", name: holders.find((h) => h.userId === found)?.user.name ?? "" });
}
