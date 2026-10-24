"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { schoolYearEnd } from "@/lib/access";
import { cairoDay, youtubeId } from "@/lib/admin-input";
import { db } from "@/lib/db";
import { phoneSchema } from "@/lib/schemas/auth";
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
      accessEndsAt: z.string().default(""),
      accessDays: z.coerce.number().int().min(1).max(3650).optional(),
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
      accessDays: d.accessDays,
      saleFrom: cairoDay(d.saleFrom, "start"),
      saleTo: cairoDay(d.saleTo, "end"),
    },
  });
  done();
}

export async function addSku(form: FormData) {
  await requireAdmin();
  const d = z
    .object({ courseId: z.string(), accessType: z.enum(["SEMESTER", "YEARLY", "REVISION", "FIXED_DAYS"]) })
    .parse(Object.fromEntries(form));
  // New packages start hidden so a half-filled price never goes on sale.
  // A full year ends with the school year; a fixed-days package starts at 90 days. The owner can change either.
  await db.sku.create({
    data: {
      ...d,
      price: 0,
      currency: "AED",
      active: false,
      accessEndsAt: d.accessType === "YEARLY" ? cairoDay(schoolYearEnd(new Date()), "end") : null,
      accessDays: d.accessType === "FIXED_DAYS" ? 90 : null,
    },
  });
  done();
}

/** Adds a rental package for one lesson: hidden, 7 days, until the owner sets a price. One per lesson. */
export async function addRental(form: FormData) {
  await requireAdmin();
  const { lessonId } = z.object({ lessonId: z.string() }).parse(Object.fromEntries(form));
  const lesson = await db.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: { unit: { select: { courseId: true } } } });
  if (!(await db.sku.count({ where: { lessonId } }))) {
    await db.sku.create({
      data: { courseId: lesson.unit.courseId, lessonId, accessType: "RENTAL", price: 0, currency: "AED", active: false, accessDays: 7 },
    });
  }
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

export async function addTeacher(_: unknown, form: FormData): Promise<"ok" | "taken" | "invalid"> {
  await requireAdmin();
  const d = z
    .object({
      name: z.string().trim().min(2).max(80),
      login: z.union([phoneSchema, z.email().trim().toLowerCase()]),
      password: z.string().min(10).max(128),
    })
    .safeParse(Object.fromEntries(form));
  if (!d.success) return "invalid";
  const { name, login, password } = d.data;
  try {
    await db.user.create({
      data: { name, role: "INSTRUCTOR", passwordHash: await bcrypt.hash(password, 10), ...(login.includes("@") ? { email: login } : { phone: login }) },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "taken";
    throw e;
  }
  done();
  return "ok";
}

const teacherId = z.string().refine(async (id) => !!(await db.user.count({ where: { id, role: { in: ["INSTRUCTOR", "ADMIN"] } } })));

/** "Physics, Grade 12" -> "physics-grade-12", plus a suffix when taken. */
async function freeSlug(base: string) {
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "course";
  return (await db.course.count({ where: { slug } })) ? `${slug}-${Date.now().toString(36)}` : slug;
}

export async function createCourse(form: FormData) {
  await requireAdmin();
  const d = await z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("SCHOOL"), gradeId: z.string(), subjectId: z.string(), instructorId: teacherId }),
      z.object({ kind: z.literal("SKILL"), titleAr: text, titleEn: text, instructorId: teacherId }),
    ])
    .parseAsync(Object.fromEntries(form));

  let data: Prisma.CourseUncheckedCreateInput;
  if (d.kind === "SCHOOL") {
    const [grade, subject] = await Promise.all([
      db.grade.findUniqueOrThrow({ where: { id: d.gradeId }, include: { country: true } }),
      db.subject.findUniqueOrThrow({ where: { id: d.subjectId } }),
    ]);
    data = {
      ...d,
      slug: await freeSlug(`${grade.country.code}-${grade.level}-${subject.slug}`),
      titleAr: `${subject.nameAr}، ${grade.nameAr}`,
      titleEn: `${subject.nameEn}, ${grade.nameEn}`,
    };
  } else {
    data = { ...d, slug: await freeSlug(d.titleEn) };
  }
  // Starts hidden, like a new package, until the owner fills it in and publishes it.
  const course = await db.course.create({ data });
  done();
  redirect(`/${form.get("locale") === "en" ? "en" : "ar"}/admin/courses/${course.id}`);
}

export async function setTeacher(form: FormData) {
  await requireAdmin();
  const d = await z.object({ id: z.string(), instructorId: teacherId }).parseAsync(Object.fromEntries(form));
  await db.course.update({ where: { id: d.id }, data: { instructorId: d.instructorId } });
  done();
}
