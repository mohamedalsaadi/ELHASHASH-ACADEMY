import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isCourseStaff } from "@/lib/catalog";
import { db } from "@/lib/db";
import { inLiveWindow } from "@/lib/premiere";
import { grantAttendReward } from "@/lib/premiere-reward";
import { watchingNow } from "@/lib/premiere-stats";

export const dynamic = "force-dynamic";

/** The open player says "still here" every 30 s and gets back how many signed-in viewers are watching. Live window only. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "signin" }, { status: 401 });
  const p = await db.premiere.findUnique({
    where: { id },
    select: { startsAt: true, cancelledAt: true, attendReward: true, video: { select: { durationSec: true } }, course: { select: { instructorId: true } } },
  });
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  const now = new Date();
  const staff = isCourseStaff(session.user, p.course);
  const live = !p.cancelledAt && inLiveWindow(now, p.startsAt, p.video.durationSec);
  if (!staff && !live) return NextResponse.json({ error: "not live" }, { status: 403 });
  const userId = session.user.id;
  await db.premiereSeen.upsert({ where: { premiereId_userId: { premiereId: id, userId } }, create: { premiereId: id, userId, seenAt: now }, update: { seenAt: now } });
  if (p.attendReward && live && !staff) await grantAttendReward(id, userId);
  return NextResponse.json({ watching: await watchingNow(id, now) });
}
