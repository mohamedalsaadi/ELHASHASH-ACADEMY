"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/auth";
import { clientIp } from "@/lib/client-ip";
import { maskContacts } from "@/lib/contact-guard";
import { db } from "@/lib/db";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { SUGGESTION_KINDS } from "@/lib/suggestions-kinds";

/** Anonymous on purpose: only the signed-in role is kept, never who. Phone numbers and emails typed into the text are masked. */
export async function sendSuggestion(_: unknown, form: FormData): Promise<"ok" | "invalid" | "limited"> {
  // A bot fills the hidden field; answer as if it worked so it does not retry.
  if (String(form.get("website") ?? "")) return "ok";
  const d = z
    .object({ kind: z.enum(SUGGESTION_KINDS), message: z.string().trim().min(10).max(1500), locale: z.enum(["ar", "en"]) })
    .safeParse(Object.fromEntries(form));
  if (!d.success) return "invalid";

  const key = `suggest:${clientIp(await headers())}`;
  if (await isLimited(key, 5, 3_600_000)) return "limited";
  await recordAttempt(key);

  const session = await auth();
  await db.suggestion.create({
    data: { kind: d.data.kind, message: maskContacts(d.data.message).text, role: session?.user?.role ?? "VISITOR", locale: d.data.locale },
  });
  return "ok";
}
