"use server";

import { z } from "zod";
import { inviteStudents } from "@/lib/course-invite";
import { redirectLocal } from "@/lib/redirect-locale";
import { requireAdmin } from "@/lib/staff";

// Every action re-checks the role: server actions are public endpoints, whatever page renders them.

const invite = z.object({
  courseId: z.string().min(1),
  titleAr: z.string().trim().min(1).max(120),
  titleEn: z.string().trim().min(1).max(120),
  bodyAr: z.string().trim().min(1).max(400),
  bodyEn: z.string().trim().min(1).max(400),
  confirm: z.literal("on"),
});

/** Sends one batch of the course invite, then returns to the panel with what was sent and what is still to reach. */
export async function sendCourseInvite(form: FormData) {
  await requireAdmin();
  const d = invite.safeParse(Object.fromEntries(form));
  if (!d.success) throw new Error("invalid invite");
  const r = await inviteStudents(d.data.courseId, {
    titleAr: d.data.titleAr,
    titleEn: d.data.titleEn,
    bodyAr: d.data.bodyAr,
    bodyEn: d.data.bodyEn,
  });
  await redirectLocal(
    `/admin/subscribers?${new URLSearchParams({ inviteCourse: d.data.courseId, sent: String(r.sent), failed: String(r.failed), left: String(r.left) })}`,
  );
}
