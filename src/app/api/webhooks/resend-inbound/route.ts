import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { htmlToText, parseFrom, shouldIgnore, ticketBody, verifySvix } from "@/lib/inbound-mail";
import { notifyAdmins } from "@/lib/notify";
import { draftTicket } from "@/lib/support";

export const dynamic = "force-dynamic";

type Received = { email_id?: string; from?: string; to?: string[]; subject?: string; text?: string; html?: string };

/** The webhook body carries the envelope; the text may need a second call to Resend's receiving API. */
async function bodyOf(data: Received): Promise<string> {
  if (data.text) return data.text;
  if (data.html) return htmlToText(data.html);
  const key = process.env.RESEND_API_KEY;
  if (!key || !data.email_id) return "";
  const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(data.email_id)}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) return "";
  const full = (await res.json().catch(() => ({}))) as Received;
  return full.text || (full.html ? htmlToText(full.html) : "");
}

/**
 * Mail sent to the support address becomes a ticket in /admin/support, with the AI draft and the usual notice. The id is derived
 * from Resend's email id, so a retried delivery finds the ticket already there and does nothing.
 */
export async function POST(req: Request) {
  const secret = process.env.RESEND_INBOUND_SECRET;
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const raw = await req.text();
  if (raw.length > 200_000) return NextResponse.json({ ok: true, ignored: "too_large" });
  const signed = verifySvix(raw, { id: req.headers.get("svix-id"), timestamp: req.headers.get("svix-timestamp"), signature: req.headers.get("svix-signature") }, secret);
  if (!signed) return NextResponse.json({ error: "bad_signature" }, { status: 401 });

  const event = JSON.parse(raw) as { type?: string; data?: Received };
  const data = event.data;
  if (event.type !== "email.received" || !data?.email_id || !data.from) return NextResponse.json({ ok: true, ignored: "not_inbound" });
  const domain = new URL(process.env.APP_URL || "https://dhirwa.ae").hostname.replace(/^www\./, "");
  const subject = data.subject ?? "";
  if (shouldIgnore({ from: data.from, to: data.to ?? [], subject }, domain)) return NextResponse.json({ ok: true, ignored: "filtered" });

  const sender = parseFrom(data.from)!;
  const text = await bodyOf(data);
  const id = `inb_${data.email_id}`.slice(0, 60);
  const created = await db.supportTicket
    .create({ data: { id, name: sender.name.slice(0, 80), email: sender.email, topic: "general", message: ticketBody(subject, text) || subject || "(empty message)" } })
    .catch((e: { code?: string }) => (e.code === "P2002" ? null : Promise.reject(e)));
  if (!created) return NextResponse.json({ ok: true, ignored: "duplicate" });

  after(async () => {
    const flag = await draftTicket(created.id);
    const needsYou = !!flag && flag !== "none";
    await notifyAdmins({
      kind: "SYSTEM",
      titleAr: `${needsYou ? "بريد دعم يحتاج قرارك" : "بريد دعم جديد"}: ${sender.name}`,
      titleEn: `${needsYou ? "Support email that needs your decision" : "New support email"}: ${sender.name}`,
      href: "/admin/support",
      dedupeKey: `ticket:${created.id}`,
      email: false,
    });
  });
  return NextResponse.json({ ok: true, ticket: created.id });
}
