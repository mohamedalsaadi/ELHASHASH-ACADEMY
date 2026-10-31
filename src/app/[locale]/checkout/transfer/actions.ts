"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { requestTransfer, saveReceipt } from "@/lib/transfer";

/** A student asks to pay this plan by bank transfer; the amount is computed server-side. */
export async function requestTransferAction(form: FormData) {
  const locale = form.get("locale") === "en" ? "en" : "ar";
  const d = z.object({ skuId: z.string(), courseSlug: z.string() }).parse(Object.fromEntries(form));

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/signin?next=${encodeURIComponent(`/${locale}/courses/${d.courseSlug}`)}`);

  const key = `transfer:${session.user.id}`;
  if (await isLimited(key, 10, 60 * 60_000)) redirect(`/${locale}/courses/${d.courseSlug}?transfer=too_many`);
  await recordAttempt(key);

  const order = await requestTransfer(session.user.id, d.skuId).catch(() => null);
  if (!order) redirect(`/${locale}/courses/${d.courseSlug}?transfer=unavailable`);

  revalidatePath("/[locale]/admin/orders", "layout");
  redirect(`/${locale}/checkout/result?order=${order.id}`);
}

/** Attaches or replaces the transfer receipt on the student's own pending order. */
export async function saveReceiptAction(_: "ok" | "invalid" | null, form: FormData): Promise<"ok" | "invalid"> {
  const session = await auth();
  if (!session?.user) return "invalid";

  const d = z
    .object({ orderId: z.string().min(1), pathname: z.string().min(1), name: z.string().max(200) })
    .safeParse(Object.fromEntries(form));
  if (!d.success) return "invalid";

  const saved = await saveReceipt({ orderId: d.data.orderId, userId: session.user.id, pathname: d.data.pathname, name: d.data.name });
  if (!saved) return "invalid";

  revalidatePath("/[locale]/checkout/result", "page");
  revalidatePath("/[locale]/admin/orders", "layout");
  return "ok";
}
