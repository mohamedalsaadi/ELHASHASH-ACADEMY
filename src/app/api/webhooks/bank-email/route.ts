import { NextResponse } from "next/server";
import { Resend } from "resend";
import { receiveBankEmail } from "@/lib/bank-email-server";

/** Strips tags for the parser; the bank's alerts are simple HTML at worst. */
const stripHtml = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const allowlist = () =>
  (process.env.BANK_SENDER_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

/**
 * Inbound bank alerts. Resend posts `email.received` with only metadata, so the body and the
 * authentication headers are fetched here. A valid svix signature proves the POST came from
 * Resend; SPF/DKIM/DMARC plus the sender allowlist are what prove it came from the bank.
 */
export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!apiKey || !secret) return NextResponse.json({ error: "not_configured" }, { status: 500 });

  const payload = await req.text();
  const resend = new Resend(apiKey);

  let event;
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: req.headers.get("svix-id") ?? "",
        timestamp: req.headers.get("svix-timestamp") ?? "",
        signature: req.headers.get("svix-signature") ?? "",
      },
      webhookSecret: secret,
    });
  } catch {
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  if (event.type !== "email.received") return NextResponse.json({ ok: true, ignored: true });

  try {
    const data = event.data;
    const email = await resend.emails.receiving.get(data.email_id);
    if (email.error || !email.data) return NextResponse.json({ error: "fetch_failed" }, { status: 500 });

    const text = email.data.text?.trim() || stripHtml(email.data.html ?? "") || "";
    const headers = Object.fromEntries(
      Object.entries(email.data.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
    );
    const authResults = headers["authentication-results"] ?? "";

    const from = (email.data.from || data.from || "").toLowerCase();
    const allowed = allowlist();
    const senderOk = allowed.includes(from);
    // An empty allowlist is misconfiguration, not a reason to discard alerts: queue them.
    const senderBlocked = allowed.length > 0 && !senderOk;
    const inbound = (process.env.BANK_INBOUND_ADDRESS ?? "").toLowerCase();
    const to = (email.data.to ?? data.to ?? []).map((a) => a.toLowerCase());
    const recipientOk = !inbound || to.includes(inbound);

    const verdict = inbound.length === 0
      ? "unknown"
      : /spf=pass/i.test(authResults) && /dkim=pass/i.test(authResults) && /dmarc=pass/i.test(authResults)
        ? "pass"
        : authResults
          ? "fail"
          : "unknown";

    const result = await receiveBankEmail({
      messageId: email.data.message_id || data.message_id || data.email_id,
      provider: "resend",
      fromAddress: from,
      toAddress: to[0] ?? "",
      subject: email.data.subject ?? data.subject ?? null,
      receivedAt: new Date(email.data.created_at ?? data.created_at ?? Date.now()),
      auth: { verdict, authenticationResults: authResults, from, to, recipientOk },
      bodyText: text,
      authenticated: senderOk && recipientOk && verdict === "pass",
      blocked: senderBlocked || !recipientOk || verdict === "fail",
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    // Only a transient failure reaches here; a 500 makes Resend retry the delivery.
    console.error("[bank-email] failed", e);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
