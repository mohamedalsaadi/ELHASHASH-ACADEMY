// Transactional email through Resend's HTTP API. No SDK: one POST. When RESEND_API_KEY is missing the
// message is logged and skipped, so local dev and preview builds keep working.

const FROM = process.env.MAIL_FROM || "Alsaadi Academy <onboarding@resend.dev>";

export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Minimal branded layout; `lines` are plain text and are escaped. */
export function emailLayout(title: string, lines: string[], cta: { href: string; label: string } | undefined, locale: "ar" | "en"): string {
  const ar = locale === "ar";
  const dir = ar ? "rtl" : "ltr";
  return `<!doctype html><html dir="${dir}" lang="${locale}"><body style="margin:0;background:#F6F7FB;font-family:Tahoma,Arial,sans-serif;color:#0D1030">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="background:#0B0F4A;color:#fff;border-radius:10px 10px 0 0;padding:20px 24px;font-size:20px;font-weight:700">${ar ? "أكاديمية السعدي" : "Alsaadi Academy"}</div>
    <div style="background:#fff;border:1px solid #E3E6F3;border-top:0;border-radius:0 0 10px 10px;padding:24px">
      <h1 style="margin:0 0 12px;font-size:20px">${esc(title)}</h1>
      ${lines.map((l) => `<p style="margin:0 0 12px;line-height:1.7">${esc(l)}</p>`).join("")}
      ${cta ? `<p style="margin:20px 0 0"><a href="${esc(cta.href)}" style="background:#2430D8;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;display:inline-block">${esc(cta.label)}</a></p>` : ""}
    </div>
    <p style="color:#8A90B0;font-size:12px;text-align:center;margin-top:16px">${ar ? "كل صفحة تفرق." : "Every page counts."}</p>
  </div>
</body></html>`;
}

export async function sendMail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[mail] skipped (no RESEND_API_KEY): ${subject}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html }),
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
