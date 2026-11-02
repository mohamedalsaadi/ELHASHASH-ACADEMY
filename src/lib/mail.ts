// Transactional email through Resend's HTTP API. No SDK: one POST. When RESEND_API_KEY is missing the
// message is logged and skipped, so local dev and preview builds keep working.

const FROM = process.env.MAIL_FROM || "Dhirwa <onboarding@resend.dev>";

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

export async function sendMail({ to, subject, html, replyTo }: { to: string; subject: string; html: string; replyTo?: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[mail] skipped (no RESEND_API_KEY): ${subject}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    if (!res.ok) {
      console.error("[mail] failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[mail] failed", e);
    return false;
  }
}
