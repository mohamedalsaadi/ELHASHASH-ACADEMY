import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { nextGrade } from "@/lib/grades-next";
import { createNotification } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Every 1 August: each student moves up one grade (same country, curriculum and track) and is told which courses are open.
 * A student is moved at most once a year (User.gradePromotedYear), so a re-run changes nothing. A student with no next grade
 * stays and is only marked. `?dry=1` reports the moves and changes nothing; run it first.
 *
 * ponytail: one notification and email at a time; move to a queue past a few thousand students.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dry = new URL(request.url).searchParams.get("dry") === "1";
  const year = new Date().getUTCFullYear();

  const grades = await db.grade.findMany({ select: { id: true, countryId: true, curriculum: true, level: true, track: true, isTerminal: true, active: true, nameAr: true, nameEn: true } });
  const open = await db.course.groupBy({ by: ["gradeId"], where: { published: true, gradeId: { not: null } }, _count: { _all: true } });
  const openBy = new Map(open.map((o) => [o.gradeId!, o._count._all]));
  const due = { role: "STUDENT" as const, deletedAt: null, OR: [{ gradePromotedYear: null }, { gradePromotedYear: { not: year } }] };

  const moves: { from: string; to: string; students: number }[] = [];
  let notified = 0;
  for (const from of grades) {
    const to = nextGrade(from, grades);
    const ids = (await db.user.findMany({ where: { ...due, gradeId: from.id }, select: { id: true } })).map((u) => u.id);
    if (ids.length === 0) continue;
    if (!to) {
      if (!dry) await db.user.updateMany({ where: { ...due, id: { in: ids } }, data: { gradePromotedYear: year } });
      continue;
    }
    moves.push({ from: `${from.nameEn}`, to: `${to.nameEn}`, students: ids.length });
    if (dry) continue;
    await db.user.updateMany({ where: { ...due, id: { in: ids } }, data: { gradeId: to.id, gradePromotedYear: year } });
    const courses = openBy.get(to.id) ?? 0;
    for (const userId of ids) {
      const n = await createNotification({
        userId,
        kind: "NEW_COURSE",
        titleAr: `أنت الآن في ${to.nameAr}`,
        titleEn: `You are now in ${to.nameEn}`,
        bodyAr: courses ? `${courses} كورسًا متاحًا لصفك الجديد. اشترك الآن وابدأ العام بقوة.` : "تابع الكورسات المتاحة لصفك الجديد.",
        bodyEn: courses ? `${courses} courses are open for your new grade. Subscribe and start the year strong.` : "See the courses open for your new grade.",
        href: "/me",
        dedupeKey: `promote:${year}:${userId}`,
      });
      if (n) notified += 1;
    }
    // Parents see it too, in the app only.
    const links = await db.parentLink.findMany({ where: { studentId: { in: ids } }, select: { parentId: true, studentId: true, student: { select: { name: true } } } });
    await db.notification.createMany({
      data: links.map((l) => ({
        userId: l.parentId,
        kind: "NEW_COURSE" as const,
        titleAr: `${l.student.name} انتقل إلى ${to.nameAr}`,
        titleEn: `${l.student.name} moved up to ${to.nameEn}`,
        href: "/parent",
        dedupeKey: `promote:${year}:${l.parentId}:${l.studentId}`,
      })),
      skipDuplicates: true,
    });
  }
  return NextResponse.json({ ok: true, year, dry, moves, notified });
}
