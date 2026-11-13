// Mail sent to the support address arrives through Resend's inbound webhook and becomes a support ticket.
// No mailbox and no second login: the owner reads and answers it in /admin/support, with the AI draft beside it.
import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_S = 5 * 60;

/**
 * Checks a Svix-signed webhook (the scheme Resend uses): HMAC-SHA256 over `id.timestamp.body` with the base64 key that follows
 * `whsec_`, compared with each `v1,` signature in the header. A timestamp more than five minutes off is refused, so a captured
 * request cannot be replayed later.
 */
export function verifySvix(body: string, headers: { id: string | null; timestamp: string | null; signature: string | null }, secret: string, now = Date.now()): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > TOLERANCE_S) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  return signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** "Name <a@b.c>" or "a@b.c" into its parts; null when there is no usable address. */
export function parseFrom(raw: string): { name: string; email: string } | null {
  const m = raw.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^<>\s]+@[^<>\s]+)>\s*$/) ?? raw.match(/^\s*()([^<>\s@]+@[^<>\s]+)\s*$/);
  if (!m) return null;
  const email = m[2].toLowerCase();
  return { name: (m[1] ?? "").trim() || email.split("@")[0], email };
}

/**
 * Mail that must not become a ticket: our own sending address (a loop), the copy the contact form sends to the support address
 * (it already has a ticket), automatic replies and bounces, and reports addressed to the dmarc mailbox.
 */
export function shouldIgnore(input: { from: string; to: string[]; subject: string }, ownDomain: string): boolean {
  const sender = parseFrom(input.from);
  if (!sender) return true;
  if (sender.email.endsWith(`@${ownDomain}`)) return true;
  if (/^(mailer-daemon|postmaster|no-?reply|noreply|do-not-reply)@/.test(sender.email)) return true;
  if (/^\[Support: /.test(input.subject)) return true;
  if (/^(auto:|automatic reply|out of office|undeliverable|delivery status)/i.test(input.subject.trim())) return true;
  const recipients = input.to.map((t) => (parseFrom(t)?.email ?? t).toLowerCase());
  return recipients.length > 0 && recipients.every((r) => r.startsWith("dmarc@"));
}

/** The ticket body: the subject line, then the text, cut to what a ticket can hold. */
export function ticketBody(subject: string, text: string): string {
  const clean = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return `${subject.trim()}\n\n${clean}`.trim().slice(0, 2000);
}

/** A plain-text version of an HTML mail, for senders that sent no text part. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
