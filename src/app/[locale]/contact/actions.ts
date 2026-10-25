"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { esc, emailLayout, sendMail } from "@/lib/mail";
import { isLimited, recordAttempt } from "@/lib/rate-limit";
import { CONTACT_EMAIL } from "@/lib/site";

export async function sendSupportMessage(_: unknown, form: FormData): Promise<"ok" | "invalid" | "limited" | "unavailable"> {
  // A bot fills the hidden field; answer as if it worked so it does not retry.
  if (String(form.get("website") ?? "")) return "ok";

  const d = z
    .object({
      name: z.string().trim().min(2).max(80),
      email: z.email().trim().toLowerCase(),
      phone: z.string().trim().max(30).default(""),
      topic: z.enum(["general", "billing", "technical", "privacy"]),
      message: z.string().trim().min(20).max(2000),
    })
    .safeParse(Object.fromEntries(form));
  if (!d.success) return "invalid";

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const key = `support:${ip}`;
  if (await isLimited(key, 5, 3_600_000)) return "limited";
  await recordAttempt(key);

  const subject = `[Support: ${d.data.topic}] ${d.data.name}`;
  const lines = [
    `Name: ${d.data.name}`,
    `Email: ${d.data.email}`,
    ...(d.data.phone ? [`Phone: ${d.data.phone}`] : []),
    "",
    d.data.message,
  ];
  const sent = await sendMail({ to: CONTACT_EMAIL, subject, html: emailLayout(subject, lines, undefined, "en"), replyTo: d.data.email });
  return sent ? "ok" : "unavailable";
}
