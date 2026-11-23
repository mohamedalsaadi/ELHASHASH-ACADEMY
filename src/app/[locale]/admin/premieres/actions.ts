"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { wallTime } from "@/lib/admin-input";
import { db } from "@/lib/db";
import { courseZone } from "@/lib/format";
import { assertCourse, requireStaff } from "@/lib/staff";

const text = z.string().trim().min(1).max(200);
const blurb = z.string().trim().max(300).transform((v) => v || null);

function done() {
  revalidatePath("/[locale]/admin/premieres", "page");
  revalidatePath("/[locale]/teacher/premieres", "page");
  revalidatePath("/[locale]/premiere/[slug]", "page");
  revalidatePath("/[locale]/courses/[slug]", "page");
}

/** The admin manages every live stream; a teacher only those of the courses they teach. */
async function staffFor(premiereId: string) {
  const me = await requireStaff();
  const { courseId } = await db.premiere.findUniqueOrThrow({ where: { id: premiereId }, select: { courseId: true } });
  await assertCourse(me, courseId);
}

/** A free session: a VdoCipher video that starts for everyone at one moment (see lib/premiere.ts for who may watch). */
export async function createPremiere(form: FormData) {
  const me = await requireStaff();
  const locale = form.get("locale") === "en" ? "en" : "ar";
  const back = `/${locale}/${me.role === "ADMIN" ? "admin" : "teacher"}/premieres`;
  const d = z
    .object({
      courseId: z.string().min(1),
      slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80),
      titleAr: text,
      titleEn: text,
      blurbAr: blurb,
      blurbEn: blurb,
      startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
      externalId: z.string().trim().min(1).max(200),
      lengthMin: z.coerce.number().int().min(1).max(600),
    })
    .parse(Object.fromEntries(form));

  await assertCourse(me, d.courseId);
  const course = await db.course.findUniqueOrThrow({ where: { id: d.courseId }, include: { grade: { include: { country: true } } } });
  const startsAt = wallTime(d.startsAt, courseZone(course));
  if (!startsAt) throw new Error("Bad start time");
  if (await db.premiere.findUnique({ where: { slug: d.slug }, select: { id: true } })) redirect(`${back}?error=slug`);

  const video = await db.videoAsset.upsert({
    where: { provider_externalId: { provider: "VDOCIPHER", externalId: d.externalId } },
    update: { durationSec: d.lengthMin * 60 },
    create: { provider: "VDOCIPHER", externalId: d.externalId, durationSec: d.lengthMin * 60 },
  });
  await db.premiere.create({
    data: {
      slug: d.slug,
      courseId: course.id,
      videoId: video.id,
      titleAr: d.titleAr,
      titleEn: d.titleEn,
      blurbAr: d.blurbAr,
      blurbEn: d.blurbEn,
      startsAt,
      replay: form.get("replay") === "on",
    },
  });
  done();
  redirect(back);
}

export async function setPremiereReplay(form: FormData) {
  const { id, replay } = z.object({ id: z.string(), replay: z.enum(["on", "off"]) }).parse(Object.fromEntries(form));
  await staffFor(id);
  await db.premiere.update({ where: { id }, data: { replay: replay === "on" } });
  done();
}

export async function cancelPremiere(form: FormData) {
  const id = z.string().parse(form.get("id"));
  await staffFor(id);
  await db.premiere.update({ where: { id }, data: { cancelledAt: new Date() } });
  done();
}
