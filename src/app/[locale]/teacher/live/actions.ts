"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { wallTime } from "@/lib/admin-input";
import { deleteRoom } from "@/lib/daily";
import { db } from "@/lib/db";
import { courseZone } from "@/lib/format";
import { assertCourse, requireAdmin, requireStaff } from "@/lib/staff";

// Teachers schedule sessions in their own courses; the seat price is the owner's, like every other price.

const fields = {
  titleAr: z.string().trim().min(1).max(200),
  titleEn: z.string().trim().min(1).max(200),
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  durationMin: z.coerce.number().int().min(15).max(300),
};

const end = (startsAt: Date, durationMin: number) => new Date(startsAt.getTime() + durationMin * 60_000);
const zoneOf = (courseId: string) =>
  db.course.findUniqueOrThrow({ where: { id: courseId }, include: { grade: { include: { country: true } } } });

function done() {
  revalidatePath("/[locale]/teacher", "layout");
  revalidatePath("/[locale]/courses", "layout");
  revalidatePath("/[locale]/live", "layout");
}

/** Closes the Daily room, if one was made, so the next join builds it again with the new times. */
async function closeRoom(s: { id: string; roomUrl: string | null }) {
  if (!s.roomUrl) return;
  await deleteRoom(s.id).catch((e) => console.error(e));
  await db.liveSession.update({ where: { id: s.id }, data: { roomUrl: null } });
}

async function ownSession(id: string) {
  const me = await requireStaff();
  const s = await db.liveSession.findUniqueOrThrow({ where: { id } });
  await assertCourse(me, s.courseId);
  return s;
}

export async function scheduleLive(form: FormData) {
  const me = await requireStaff();
  const d = z.object({ courseId: z.string(), locale: z.enum(["ar", "en"]), ...fields }).parse(Object.fromEntries(form));
  await assertCourse(me, d.courseId);
  const course = await zoneOf(d.courseId);
  const startsAt = wallTime(d.startsAt, courseZone(course))!;
  if (startsAt <= new Date()) redirect(`/${d.locale}/teacher/live?error=past`);
  const endsAt = end(startsAt, d.durationMin);
  // The seat starts hidden at 0 until the owner prices it; it can be bought until the session ends.
  await db.liveSession.create({
    data: {
      courseId: d.courseId,
      titleAr: d.titleAr,
      titleEn: d.titleEn,
      startsAt,
      durationMin: d.durationMin,
      sku: {
        create: {
          courseId: d.courseId,
          accessType: "LIVE",
          price: 0,
          currency: course.grade?.country.currency ?? "AED",
          active: false,
          saleTo: endsAt,
          accessEndsAt: endsAt,
        },
      },
    },
  });
  done();
  redirect(`/${d.locale}/teacher/live`);
}

export async function updateLive(form: FormData) {
  const d = z.object({ id: z.string(), ...fields }).parse(Object.fromEntries(form));
  const s = await ownSession(d.id);
  const startsAt = wallTime(d.startsAt, courseZone(await zoneOf(s.courseId)))!;
  const endsAt = end(startsAt, d.durationMin);
  await db.$transaction([
    db.liveSession.update({ where: { id: s.id }, data: { titleAr: d.titleAr, titleEn: d.titleEn, startsAt, durationMin: d.durationMin } }),
    db.sku.updateMany({ where: { liveSessionId: s.id }, data: { saleTo: endsAt, accessEndsAt: endsAt } }),
    // Seats already sold move with the session.
    db.entitlement.updateMany({ where: { liveSessionId: s.id }, data: { endsAt } }),
  ]);
  if (startsAt.getTime() !== s.startsAt.getTime() || d.durationMin !== s.durationMin) await closeRoom(s);
  done();
}

/** Keeps the session and its sold seats on record (for refunds) but stops sales and closes the room. */
export async function cancelLive(form: FormData) {
  const s = await ownSession(z.string().parse(form.get("id")));
  await db.$transaction([
    db.liveSession.update({ where: { id: s.id }, data: { cancelledAt: new Date() } }),
    db.sku.updateMany({ where: { liveSessionId: s.id }, data: { active: false } }),
  ]);
  await closeRoom(s);
  done();
}

export async function setSeatPrice(form: FormData) {
  await requireAdmin();
  const d = z
    .object({ id: z.string(), price: z.coerce.number().min(0).max(1_000_000), active: z.literal("on").optional().transform(Boolean) })
    .parse(Object.fromEntries(form));
  await db.sku.updateMany({ where: { id: d.id, accessType: "LIVE", liveSession: { cancelledAt: null } }, data: { price: Math.round(d.price * 100), active: d.active } });
  done();
}
