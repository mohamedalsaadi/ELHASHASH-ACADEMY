"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { maskContacts } from "@/lib/contact-guard";
import { db } from "@/lib/db";
import { notifyAdmins } from "@/lib/notify";
import { HELD_AT_STARS } from "@/lib/review-eligibility";
import { rateState } from "@/lib/reviews";

export type ReviewState = "ok" | "held" | "closed" | "masked" | "invalid" | "already" | null;

/**
 * A subscriber rates a course once they have really taken it (see canRate). One review per student and course.
 * One or two out of five waits for an admin; the student can still edit it while it waits, but not after it was decided.
 */
export async function submitReview(_prev: ReviewState, form: FormData): Promise<ReviewState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") notFound();
  const studentId = session.user.id;
  const d = z.object({ courseId: z.string().min(1), stars: z.coerce.number().int().min(1).max(5), text: z.string().trim().max(1500).optional() }).safeParse(Object.fromEntries(form));
  if (!d.success) return "invalid";
  const course = await db.course.findUnique({ where: { id: d.data.courseId }, select: { id: true, slug: true, titleAr: true, titleEn: true, published: true } });
  if (!course?.published) notFound();

  const state = await rateState(studentId, course.id);
  if (!state.eligible) return "closed";
  if (state.mine && state.mine.status !== "HELD") return "already";

  const text = d.data.text || null;
  if (text && maskContacts(text).masked) return "masked";
  const held = d.data.stars <= HELD_AT_STARS;
  const status = held ? "HELD" : "PUBLISHED";
  const review = await db.courseReview.upsert({
    where: { courseId_studentId: { courseId: course.id, studentId } },
    create: { courseId: course.id, studentId, stars: d.data.stars, text, status },
    update: { stars: d.data.stars, text, status },
    select: { id: true, updatedAt: true },
  });
  if (held) {
    await notifyAdmins({
      kind: "SYSTEM",
      titleAr: `تقييم منخفض ينتظر قرارك: ${course.titleAr}`,
      titleEn: `A low rating needs your decision: ${course.titleEn}`,
      href: "/admin/reviews",
      email: false,
      dedupeKey: `review-held:${review.id}:${review.updatedAt.getTime()}`,
    });
  }
  revalidatePath("/[locale]/courses/[slug]", "page");
  revalidatePath("/[locale]/teachers/[id]", "page");
  return held ? "held" : "ok";
}
