// Transactional email through Resend's HTTP API. No SDK: one POST. When RESEND_API_KEY is missing the
// message is logged and skipped, so local dev and preview builds keep working.

// MAIL_FROM is pasted into a dashboard, so tolerate stray quotes and spaces; anything Resend would still reject
// falls back to the domain's no-reply address.
const ADDR = String.raw`[^\s<>@"]+@[^\s<>@"]+\.[^\s<>@"]+`;
const VALID_FROM = new RegExp(`^(?:${ADDR}|[^<>"]+ <${ADDR}>)$`);
const FROM = (() => {
  const v = (process.env.MAIL_FROM ?? "").replace(/\s+/g, " ").trim().replace(/^["']+|["']+$/g, "").trim();
  return VALID_FROM.test(v) ? v : "Dhirwa <no-reply@dhirwa.ae>";
})();

export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Minimal branded layout (Contour: survey paper, a night-map band with the name and its summit-gold point, a trail-green
 * button). Hex is allowed here only: email clients cannot read CSS variables. `lines` are plain text and are escaped. */
export function emailLayout(title: string, lines: string[], cta: { href: string; label: string } | undefined, locale: "ar" | "en"): string {
  const ar = locale === "ar";
  const dir = ar ? "rtl" : "ltr";
  return `<!doctype html><html dir="${dir}" lang="${locale}"><body style="margin:0;background:#F6F3EC;font-family:Tahoma,Arial,sans-serif;color:#13202F">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="background:#0F1B2D;color:#EEF0EA;border-radius:16px 16px 0 0;padding:20px 24px;font-size:20px;font-weight:700">${ar ? "ذروة" : "Dhirwa"}<span style="color:#E8B04B"> •</span></div>
    <div style="background:#FFFFFF;border:1px solid #E4DFD3;border-top:0;border-radius:0 0 16px 16px;padding:24px">
      <h1 style="margin:0 0 12px;font-size:20px">${esc(title)}</h1>
      ${lines.map((l) => `<p style="margin:0 0 12px;line-height:1.7">${esc(l)}</p>`).join("")}
      ${cta ? `<p style="margin:20px 0 0"><a href="${esc(cta.href)}" style="background:#1F7356;color:#FFFFFF;text-decoration:none;padding:12px 20px;border-radius:999px;display:inline-block;font-weight:600">${esc(cta.label)}</a></p>` : ""}
    </div>
    <p style="color:#586273;font-size:12px;text-align:center;margin-top:16px">${ar ? "كل درس خطوة نحو الذروة." : "Every lesson is a step toward the peak."}</p>
  </div>
</body></html>`;
}

/** A plain-text twin of the HTML: mail with no text part is more likely to be filtered. */
const toText = (html: string) =>
  html
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g, "$2: $1")
    .replace(/<\/(p|h1|div)>/g, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** Sends one message and says what Resend answered: `ok` with its message id, or the reason it was refused. */
export async function sendMailDetailed({ to, subject, html, replyTo }: { to: string; subject: string; html: string; replyTo?: string }): Promise<{ ok: boolean; detail: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[mail] skipped (no RESEND_API_KEY): ${subject}`);
    return { ok: false, detail: "RESEND_API_KEY is not set" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html, text: toText(html), ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error("[mail] failed", res.status, body);
      return { ok: false, detail: `${res.status} ${body}` };
    }
    const id = (JSON.parse(body) as { id?: string }).id ?? "?";
    console.info(`[mail] sent ${id} from ${FROM.replace(/^.*@/, "").replace(">", "")} to ${to.replace(/^.*@/, "@")}`);
    return { ok: true, detail: id };
  } catch (e) {
    console.error("[mail] failed", e);
    return { ok: false, detail: String(e) };
  }
}

export async function sendMail(m: { to: string; subject: string; html: string; replyTo?: string }): Promise<boolean> {
  return (await sendMailDetailed(m)).ok;
}
