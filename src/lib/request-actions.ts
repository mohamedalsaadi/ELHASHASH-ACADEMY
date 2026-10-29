"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { maskContacts } from "@/lib/contact-guard";
import { db } from "@/lib/db";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { requireStaff } from "@/lib/staff";

export type RequestError = "invalid" | "limited" | "unlinked" | "ok" | "masked" | null;

const staffCanSee = async (requestId: string) => {
  const me = await requireStaff();
  const request = await db.specialRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: { id: true, authorId: true, course: { select: { instructorId: true } } },
  });
  const allowed = me.role === "ADMIN" || (request.course?.instructorId === me.id && request.course !== null);
  if (!allowed) notFound();
  return { me, request };
};

/** A parent asks management — and optionally the course teacher — about their own child. */
export async function createSpecialRequest(_prev: RequestError, form: FormData): Promise<RequestError> {
  const session = await auth();
  if (!session?.user || session.user.role !== "PARENT") notFound();

  const parsed = z
    .object({
      studentId: z.string().min(1),
      courseId: z.string().optional(),
      subject: z.string().trim().min(3).max(160),
      body: z.string().trim().min(10).max(4000),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return "invalid";
  const d = parsed.data;

  const link = await db.parentLink.findFirst({ where: { parentId: session.user.id, studentId: d.studentId }, select: { id: true } });
  if (!link) return "unlinked";

  // A course may only be named if the child has actually held access to it.
  let courseId: string | null = null;
  if (d.courseId) {
    const held = await db.entitlement.findFirst({ where: { userId: d.studentId, courseId: d.courseId }, select: { id: true } });
    if (!held) return "invalid";
    courseId = d.courseId;
  }

  if (await isLimited(`request:${session.user.id}`, 5, 86_400_000)) return "limited";

  const subject = maskContacts(d.subject);
  const body = maskContacts(d.body);

  const request = await db.specialRequest.create({
    data: { authorId: session.user.id, studentId: d.studentId, courseId, subject: subject.text, body: body.text },
  });
  await recordAttempt(`request:${session.user.id}`);

  // Management always; the course teacher only when the parent named a course.
  const recipients = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  const teacher = courseId
    ? await db.course.findUnique({ where: { id: courseId }, select: { instructorId: true } })
    : null;
  const targets = [...new Set([...recipients.map((r) => r.id), ...(teacher ? [teacher.instructorId] : [])])];
  if (targets.length > 0) {
    await db.notification.createMany({
      data: targets.map((userId) => ({
        userId,
        kind: "REQUEST_NEW" as const,
        titleAr: `طلب جديد: ${request.subject}`,
        titleEn: `New request: ${request.subject}`,
        href: userId === teacher?.instructorId ? `/teacher/requests` : `/admin/requests`,
        dedupeKey: `req:${request.id}:${userId}`,
      })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/[locale]/parent/requests", "page");
  revalidatePath("/[locale]/admin/requests", "page");
  revalidatePath("/[locale]/teacher/requests", "page");
  return subject.masked || body.masked ? "masked" : "ok";
}

/** The authoring parent replies to their own thread. */
export async function parentReply(_prev: RequestError, form: FormData): Promise<RequestError> {
  const session = await auth();
  if (!session?.user) notFound();
  const parsed = z.object({ id: z.string().min(1), body: z.string().trim().min(2).max(4000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return "invalid";

  const request = await db.specialRequest.findUniqueOrThrow({ where: { id: parsed.data.id }, select: { id: true, authorId: true, status: true } });
  if (request.authorId !== session.user.id) notFound();
  if (request.status === "CLOSED") return "invalid";
  if (await isLimited(`reply:${session.user.id}`, 20, 86_400_000)) return "limited";

  const body = maskContacts(parsed.data.body).text;
  const reply = await db.specialRequestReply.create({ data: { requestId: request.id, authorId: session.user.id, body } });
  await db.specialRequest.update({ where: { id: request.id }, data: { status: "OPEN" } });
  await recordAttempt(`reply:${session.user.id}`);

  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length > 0) {
    await db.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        kind: "REQUEST_REPLY" as const,
        titleAr: "رد جديد على طلب",
        titleEn: "New reply on a request",
        href: "/admin/requests",
        dedupeKey: `req-reply:${reply.id}:${a.id}`,
      })),
      skipDuplicates: true,
    });
  }

  revalidatePath("/[locale]/parent/requests", "page");
  revalidatePath("/[locale]/admin/requests", "page");
  return "ok";
}

/** Staff (admin, or the course's own teacher) answer a request; the parent is told. */
export async function staffReply(_prev: RequestError, form: FormData): Promise<RequestError> {
  const parsed = z.object({ id: z.string().min(1), body: z.string().trim().min(2).max(4000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return "invalid";
  const { me, request } = await staffCanSee(parsed.data.id);

  if (await isLimited(`reply:${me.id}`, 20, 86_400_000)) return "limited";
  const body = maskContacts(parsed.data.body).text;
  const reply = await db.specialRequestReply.create({ data: { requestId: request.id, authorId: me.id, body } });
  await db.specialRequest.update({ where: { id: request.id }, data: { status: "ANSWERED" } });
  await recordAttempt(`reply:${me.id}`);

  await db.notification
    .create({
      data: {
        userId: request.authorId,
        kind: "REQUEST_REPLY",
        titleAr: "رد على طلبك",
        titleEn: "Reply to your request",
        href: "/parent/requests",
        dedupeKey: `req-reply:${reply.id}:${request.authorId}`,
      },
    })
    .catch(() => null);

  revalidatePath("/[locale]/admin/requests", "page");
  revalidatePath("/[locale]/teacher/requests", "page");
  revalidatePath("/[locale]/parent/requests", "page");
  return "ok";
}

/** Only staff close a thread; a closed request refuses new parent replies. */
export async function closeRequest(form: FormData) {
  const parsed = z.object({ id: z.string().min(1) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) notFound();
  const { request } = await staffCanSee(parsed.data.id);
  await db.specialRequest.update({ where: { id: request.id }, data: { status: "CLOSED" } });
  revalidatePath("/[locale]/admin/requests", "page");
  revalidatePath("/[locale]/teacher/requests", "page");
  revalidatePath("/[locale]/parent/requests", "page");
}
