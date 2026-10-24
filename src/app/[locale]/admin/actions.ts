"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cairoDay, youtubeId } from "@/lib/admin-input";
import { db } from "@/lib/db";
import { assertCourse, requireAdmin, requireStaff } from "@/lib/staff";

// Every action re-checks the role: server actions are public endpoints, whatever page renders them.

const text = z.string().trim().min(1).max(200);
const optionalText = z.string().trim().max(2000).transform((s) => s || null);
const checkbox = z.literal("on").optional().transform(Boolean);

const unitCourse = async (id: string) =>
  (await db.unit.findUniqueOrThrow({ where: { id }, select: { courseId: true } })).courseId;
const lessonCourse = async (id: string) =>
  (await db.lesson.findUniqueOrThrow({ where: { id }, select: { unit: { select: { courseId: true } } } })).unit.courseId;

function done() {
  revalidatePath("/[locale]/admin", "layout");
  revalidatePath("/[locale]/courses", "layout");
  revalidatePath("/[locale]/teacher", "layout");
  revalidatePath("/[locale]/teachers", "layout");
}

export async function updateCourse(form: FormData) {
  const me = await requireStaff();
  const d = z
    .object({ id: z.string(), titleAr: text, titleEn: text, descAr: optionalText, descEn: optionalText, published: checkbox })
    .parse(Object.fromEntries(form));
  const { id, ...data } = d;
  await assertCourse(me, id);
  await db.course.update({ where: { id }, data });
  done();
}

export async function updateUnit(form: FormData) {
  const me = await requireStaff();
  const { id, ...data } = z
    .object({ id: z.string(), titleAr: text, titleEn: text, isFree: checkbox })
    .parse(Object.fromEntries(form));
  await assertCourse(me, await unitCourse(id));
  await db.unit.update({ where: { id }, data });
  done();
}

export async function addUnit(form: FormData) {
  const me = await requireStaff();
  const courseId = z.string().parse(form.get("courseId"));
  await assertCourse(me, courseId);
  const last = await db.unit.findFirst({ where: { courseId }, orderBy: { order: "desc" } });
  const order = (last?.order ?? 0) + 1;
  await db.unit.create({ data: { courseId, order, titleAr: `الوحدة ${order}`, titleEn: `Unit ${order}` } });
  done();
}

export async function addLesson(form: FormData) {
  const me = await requireStaff();
  const unitId = z.string().parse(form.get("unitId"));
  await assertCourse(me, await unitCourse(unitId));
  const last = await db.lesson.findFirst({ where: { unitId }, orderBy: { order: "desc" } });
  const order = (last?.order ?? 0) + 1;
  await db.lesson.create({ data: { unitId, order, kind: "VIDEO", titleAr: `درس ${order}`, titleEn: `Lesson ${order}` } });
  done();
}

export async function deleteLesson(form: FormData) {
  const me = await requireStaff();
  const id = z.string().parse(form.get("id"));
  await assertCourse(me, await lessonCourse(id));
  await db.lesson.delete({ where: { id } });
  done();
}

export async function updateLesson(form: FormData) {
  const me = await requireStaff();
  const d = z
    .object({
      id: z.string(),
      titleAr: text,
      titleEn: text,
      kind: z.enum(["VIDEO", "EXAM_STRUCTURE", "PAST_QUESTIONS", "PDF"]),
      provider: z.enum(["", "VDOCIPHER", "YOUTUBE"]),
      externalId: z.string().trim().max(200),
    })
    .parse(Object.fromEntries(form));
  await assertCourse(me, await lessonCourse(d.id));

  let videoId: string | null = null;
  if (d.provider && d.externalId) {
    const externalId = d.provider === "YOUTUBE" ? youtubeId(d.externalId) : d.externalId;
    if (!externalId) throw new Error("Not a YouTube link");
    const video = await db.videoAsset.upsert({
      where: { provider_externalId: { provider: d.provider, externalId } },
      update: {},
      create: { provider: d.provider, externalId },
    });
    videoId = video.id;
  }
  await db.lesson.update({ where: { id: d.id }, data: { titleAr: d.titleAr, titleEn: d.titleEn, kind: d.kind, videoId } });
  done();
}

export async function updateSku(form: FormData) {
  await requireAdmin();
  const d = z
    .object({
      id: z.string(),
      price: z.coerce.number().min(0).max(1_000_000),
      active: checkbox,
      accessEndsAt: z.string(),
      saleFrom: z.string(),
      saleTo: z.string(),
    })
    .parse(Object.fromEntries(form));
  await db.sku.update({
    where: { id: d.id },
    data: {
      price: Math.round(d.price * 100),
      active: d.active,
      accessEndsAt: cairoDay(d.accessEndsAt, "end"),
      saleFrom: cairoDay(d.saleFrom, "start"),
      saleTo: cairoDay(d.saleTo, "end"),
    },
  });
  done();
}

export async function addSku(form: FormData) {
  await requireAdmin();
  const d = z
    .object({ courseId: z.string(), accessType: z.enum(["SEMESTER", "YEARLY", "REVISION"]) })
    .parse(Object.fromEntries(form));
  // New packages start hidden so a half-filled price never goes on sale.
  await db.sku.create({ data: { ...d, price: 0, currency: "AED", active: false } });
  done();
}

export async function changePassword(_: unknown, form: FormData): Promise<"ok" | "wrong" | "short"> {
  const me = await requireStaff();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < 10) return "short";
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await bcrypt.compare(current, user.passwordHash))) return "wrong";
  await db.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  return "ok";
}

const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((s) => !s || /^https:\/\/\S+$/.test(s), "https link")
  .transform((s) => s || null);

export async function updateProfile(form: FormData) {
  const me = await requireStaff();
  const data = z
    .object({ photoUrl: httpsUrl, bioAr: optionalText, bioEn: optionalText })
    .parse(Object.fromEntries(form));
  await db.user.update({ where: { id: me.id }, data });
  done();
}
