"use server";

import { z } from "zod";
import { inviteStudents, sendInviteTest } from "@/lib/course-invite";
import { redirectLocal } from "@/lib/redirect-locale";
import { requireAdmin } from "@/lib/staff";

// Every action re-checks the role: server actions are public endpoints, whatever page renders them.

const copyFields = z.object({
  courseId: z.string().min(1),
  titleAr: z.string().trim().min(1).max(120),
  titleEn: z.string().trim().min(1).max(120),
  bodyAr: z.string().trim().min(1).max(400),
  bodyEn: z.string().trim().min(1).max(400),
});
const invite = copyFields.extend({ confirm: z.literal("on"), whatsapp: z.literal("on").optional() });

/** Sends one batch of the course invite, then returns to the panel with what was sent and what is still to reach. */
export async function sendCourseInvite(form: FormData) {
  await requireAdmin();
  const d = invite.safeParse(Object.fromEntries(form));
  if (!d.success) throw new Error("invalid invite");
  const { courseId, whatsapp } = d.data;
  const r = await inviteStudents(courseId, copyFields.parse(d.data), { whatsapp: whatsapp === "on" });
  const q = new URLSearchParams({
    inviteCourse: courseId,
    notices: String(r.notices),
    sent: String(r.sent),
    failed: String(r.failed),
    left: String(r.left),
    ...(whatsapp === "on" ? { waSent: String(r.waSent), waFailed: String(r.waFailed), ...(r.waError ? { waError: String(r.waError) } : {}) } : {}),
  });
  await redirectLocal(`/admin/subscribers?${q}`);
}

/** Sends the invite to the admin's own email and WhatsApp number only; no student is touched and nothing is stored. */
export async function sendInviteTestCopy(form: FormData) {
  const me = await requireAdmin();
  const d = copyFields.safeParse(Object.fromEntries(form));
  if (!d.success) throw new Error("invalid invite");
  const { courseId, ...copy } = d.data;
  const r = await sendInviteTest(courseId, copy, me.id);
  await redirectLocal(`/admin/subscribers?${new URLSearchParams({ inviteCourse: courseId, test: r.email ? "ok" : "fail", testWa: r.whatsapp })}`);
}
