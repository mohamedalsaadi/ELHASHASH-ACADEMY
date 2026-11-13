"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/staff";

/**
 * The admin's decision on a held review. Publishing keeps it as the student wrote it; removing needs a written reason.
 * Both record who decided and when, so a negative review can never disappear without a trace.
 */
export async function decideReview(form: FormData) {
  const me = await requireAdmin();
  const d = z
    .object({ id: z.string().min(1), decision: z.enum(["publish", "remove"]), reason: z.string().trim().max(1000).optional() })
    .refine((v) => v.decision === "publish" || (v.reason?.length ?? 0) >= 3)
    .parse(Object.fromEntries(form));
  await db.courseReview.updateMany({
    where: { id: d.id, status: "HELD" },
    data: { status: d.decision === "publish" ? "PUBLISHED" : "REMOVED", adminNote: d.decision === "remove" ? d.reason : null, decidedById: me.id, decidedAt: new Date() },
  });
  revalidatePath("/[locale]/admin/reviews", "page");
  revalidatePath("/[locale]/courses/[slug]", "page");
  revalidatePath("/[locale]/teachers/[id]", "page");
}
