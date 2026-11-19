// The invite-a-friend ad as an HTML email. It carries no personal link (one email goes to many people); the button leads
// to sign-up and a second link to the account page, where each person's own link lives. Hex is allowed here only:
// email clients cannot read CSS variables. Colours are the First light tokens (DESIGN.md), gold for the earned figure only.
import { appUrl, esc } from "@/lib/mail";
import { referralAdT, type AdLocale } from "@/lib/referral-ad";

const C = { ground: "#F5F5F7", card: "#FFFFFF", ink: "#1D1D1F", muted: "#636366", hair: "#E2E2E6", gold: "#E8B04B" };
const FONT = `'IBM Plex Sans Arabic','Readex Pro',Tahoma,Arial,sans-serif`;

export function referralAdSubject(locale: AdLocale, percent: number): string {
  return referralAdT(locale)("emailSubject", { pct: percent });
}

/**
 * Direction is set on the body and on a wrapper div as well as on <html>: Gmail and Outlook drop attributes on <html> and
 * <body>, and the wrapper is what every block inherits (the same fix as the course invite, src/lib/course-email.ts).
 */
export function renderReferralAdEmail(locale: AdLocale, opts: { percent: number; unsubscribe?: string }): string {
  const t = referralAdT(locale);
  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const start = isAr ? "right" : "left";
  const pct = opts.percent;
  const base = `${appUrl()}/${locale}`;
  const rules = [t("rule1"), t("rule2"), t("rule3")]
    .map((r) => `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${C.ink}"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${C.gold};margin-${isAr ? "left" : "right"}:10px"></span>${esc(r)}</p>`)
    .join("");

  return `<!doctype html><html dir="${dir}" lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(t("title", { pct }))}</title></head>
<body dir="${dir}" style="margin:0;background:${C.ground};font-family:${FONT};color:${C.ink};direction:${dir};text-align:${start}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(t("emailPreheader", { pct }))}</div>
<div dir="${dir}" lang="${locale}" style="max-width:560px;margin:0 auto;padding:28px 16px;direction:${dir};text-align:${start}">
  <p style="margin:0 0 16px;font-size:22px;font-weight:700;color:${C.ink}">${isAr ? "ذروة" : "Dhirwa"}<span style="color:${C.gold}"> &#9679;</span></p>
  <div style="background:${C.card};border:1px solid ${C.hair};border-radius:20px;padding:28px 24px">
    <p style="margin:0 0 14px"><span style="display:inline-block;background:${C.gold};color:${C.ink};font-weight:700;font-size:15px;padding:6px 14px;border-radius:999px">${esc(t("badge", { pct }))}</span></p>
    <h1 style="margin:0 0 10px;font-size:26px;line-height:1.3;color:${C.ink}">${esc(t("title", { pct }))}</h1>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:${C.muted}">${esc(t("line", { pct }))}</p>
    ${rules}
    <p style="margin:16px 0 22px;font-size:14px;line-height:1.7;color:${C.muted}">${esc(t("emailHow"))}</p>
    <p style="margin:0 0 14px"><a href="${esc(`${base}/signup`)}" style="display:inline-block;background:${C.ink};color:#FFFFFF;font-weight:700;font-size:15px;text-decoration:none;padding:12px 22px;border-radius:999px">${esc(t("emailButton"))}</a></p>
    <p style="margin:0;font-size:13px"><a href="${esc(`${base}/account`)}" style="color:${C.muted}">${esc(t("emailHave"))}</a></p>
  </div>
  <p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:${C.muted};text-align:center">${esc(t("what"))}<br>${esc(t("tagline"))}</p>
  ${opts.unsubscribe ? `<p style="margin:10px 0 0;font-size:12px;text-align:center"><a href="${esc(opts.unsubscribe)}" style="color:${C.muted}">${esc(t("unsubscribe"))}</a></p>` : ""}
</div>
</body></html>`;
}
