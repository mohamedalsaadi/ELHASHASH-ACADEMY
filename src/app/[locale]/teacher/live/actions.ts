"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { wallTime } from "@/lib/admin-input";
import { db } from "@/lib/db";
import { courseZone, toMinor } from "@/lib/format";
import { canPublishLive } from "@/lib/live";
import { notifyLiveScheduled } from "@/lib/live-alerts";
import { meetingUrlError } from "@/lib/live-rules";
import { assertCourse, requireStaff } from "@/lib/staff";

// Teachers schedule sessions and set the seat price in their own courses.

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

/** The teacher's own meeting link, or null. An empty field clears it; a bad host is refused. */
function meetingLink(form: FormData, locale: string): string | null {
  const raw = String(form.get("meetingUrl") ?? "");
  if (meetingUrlError(raw) === "invalid") redirect(`${home(form, locale)}?error=link`);
  return raw.trim() || null;
}

/** Where the form came from: the course editor posts back=course with its courseId, the live page posts neither. */
const home = (form: FormData, locale: string) => {
  const courseId = String(form.get("courseId") ?? "");
  return form.get("back") === "course" && courseId ? `/${locale}/admin/courses/${courseId}` : `/${locale}/teacher/live`;
};

/** Admins always may; a teacher only after an admin turned live on for them. */
async function assertCanPublish(me: { id: string; role: string }, locale: string, back = `/${locale}/teacher/live`) {
  if (!(await canPublishLive(me))) redirect(`${back}?error=notApproved`);
}

/** setSeatPrice is also posted from the admin screen, which carries no locale field. */
const readLocale = (form: FormData) => (form.get("locale") === "en" ? "en" : "ar");

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
  await assertCanPublish(me, d.locale, home(form, d.locale));
  const roomUrl = meetingLink(form, d.locale);
  const course = await zoneOf(d.courseId);
  const startsAt = wallTime(d.startsAt, courseZone(course))!;
  if (startsAt <= new Date()) redirect(`${home(form, d.locale)}?error=past`);
  const endsAt = end(startsAt, d.durationMin);
  // The seat starts hidden at 0 until the owner prices it; it can be bought until the session ends.
  const created = await db.liveSession.create({
    data: {
      courseId: d.courseId,
      titleAr: d.titleAr,
      titleEn: d.titleEn,
      startsAt,
      durationMin: d.durationMin,
      roomUrl,
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
  // Every student of the grade hears about it (in-app); the same-day email comes from the morning cron.
  after(() => notifyLiveScheduled(created.id));
  redirect(home(form, d.locale));
}

export async function updateLive(form: FormData) {
  const d = z.object({ id: z.string(), locale: z.enum(["ar", "en"]), ...fields }).parse(Object.fromEntries(form));
  const me = await requireStaff();
  const s = await ownSession(d.id);
  await assertCanPublish(me, d.locale);
  const roomUrl = meetingLink(form, d.locale);
  const startsAt = wallTime(d.startsAt, courseZone(await zoneOf(s.courseId)))!;
  const endsAt = end(startsAt, d.durationMin);
  await db.$transaction([
    db.liveSession.update({
      where: { id: s.id },
      data: { titleAr: d.titleAr, titleEn: d.titleEn, startsAt, durationMin: d.durationMin, roomUrl },
    }),
    db.sku.updateMany({ where: { liveSessionId: s.id }, data: { saleTo: endsAt, accessEndsAt: endsAt } }),
    // Seats already sold move with the session.
    db.entitlement.updateMany({ where: { liveSessionId: s.id }, data: { endsAt } }),
  ]);
  done();
}

/** Keeps the session and its sold seats on record (for refunds) but stops sales. */
export async function cancelLive(form: FormData) {
  const s = await ownSession(z.string().parse(form.get("id")));
  await db.$transaction([
    db.liveSession.update({ where: { id: s.id }, data: { cancelledAt: new Date() } }),
    db.sku.updateMany({ where: { liveSessionId: s.id }, data: { active: false } }),
  ]);
  done();
}

export async function setSeatPrice(form: FormData) {
  const me = await requireStaff();
  const d = z
    .object({ id: z.string(), price: z.coerce.number().min(0).max(1_000_000), active: z.literal("on").optional().transform(Boolean) })
    .parse(Object.fromEntries(form));
  const sku = await db.sku.findFirstOrThrow({ where: { id: d.id, accessType: "LIVE" }, select: { currency: true, courseId: true } });
  await assertCourse(me, sku.courseId);
  await assertCanPublish(me, readLocale(form));
  await db.sku.updateMany({
    where: { id: d.id, accessType: "LIVE", liveSession: { cancelledAt: null } },
    data: { price: toMinor(d.price, sku.currency), active: d.active },
  });
  done();
}

/** After a session: the teacher's recording (already uploaded to VdoCipher) becomes a protected lesson at the end of the course's last topic. */
export async function addRecording(form: FormData) {
  const me = await requireStaff();
  const d = z.object({ id: z.string(), locale: z.enum(["ar", "en"]), externalId: z.string().trim().max(200) }).parse(Object.fromEntries(form));
  const s = await ownSession(d.id);
  const back = `/${d.locale}/admin/courses/${s.courseId}`;
  if (!d.externalId) redirect(`${back}?error=noVideo`);
  const unit = await db.unit.findFirst({ where: { courseId: s.courseId }, orderBy: { order: "desc" }, select: { id: true } });
  if (!unit) redirect(`${back}?error=noUnit`);
  const video = await db.videoAsset.upsert({
    where: { provider_externalId: { provider: "VDOCIPHER", externalId: d.externalId } },
    update: {},
    create: { provider: "VDOCIPHER", externalId: d.externalId },
  });
  const last = await db.lesson.findFirst({ where: { unitId: unit.id }, orderBy: { order: "desc" }, select: { order: true } });
  await db.lesson.create({
    data: { unitId: unit.id, order: (last?.order ?? 0) + 1, kind: "VIDEO", titleAr: s.titleAr, titleEn: s.titleEn, videoId: video.id, instructorId: me.role === "ADMIN" ? null : me.id },
  });
  done();
  revalidatePath("/[locale]/admin/courses/[id]", "page");
  redirect(back);
}
