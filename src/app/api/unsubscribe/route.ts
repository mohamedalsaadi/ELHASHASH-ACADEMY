import { db } from "@/lib/db";
import { verifyUnsubscribe } from "@/lib/unsubscribe";

/** The user id from a genuine signed link, or null for anything else. */
function signedUser(request: Request): string | null {
  const params = new URL(request.url).searchParams;
  const userId = params.get("u") ?? "";
  const sig = params.get("s") ?? "";
  return userId && sig && verifyUnsubscribe(userId, sig) ? userId : null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type State = "confirm" | "done" | "invalid";

const page = (state: State, action = "") => {
  const ok = state !== "invalid";
  const done = state === "done";
  const title = !ok ? "الرابط غير صالح" : done ? "أوقفنا الرسائل الاختيارية" : "إيقاف الرسائل الاختيارية؟";
  const body = !ok
    ? "تعذّر التحقق من الرابط. افتح حسابك وأوقف الرسائل من صفحة الحساب."
    : done
      ? "لن تصلك رسائل التذكير والتنبيهات بعد الآن. إيصالات الدفع ورسائل أمان الحساب ستصلك دائمًا."
      : "اضغط الزر لإيقاف رسائل التذكير والتنبيهات. إيصالات الدفع ورسائل أمان الحساب ستصلك دائمًا.";
  const titleEn = !ok ? "This link is not valid" : done ? "Optional emails are off" : "Turn off optional emails?";
  const bodyEn = !ok
    ? "We could not check this link. Open your account and turn optional emails off there."
    : done
      ? "You will no longer get reminders or updates. Payment receipts and account security emails always reach you."
      : "Press the button to stop reminders and updates. Payment receipts and account security emails always reach you.";
  const form =
    state === "confirm"
      ? `<form method="post" action="${esc(action)}" style="margin:16px 0 0"><button type="submit" style="padding:10px 18px;border:0;border-radius:12px;background:#1D1D1F;color:#fff;font:inherit;cursor:pointer">إيقاف الرسائل / Turn off emails</button></form>`
      : "";
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>ذروة</title></head>
<body style="margin:0;font-family:Tahoma,Arial,sans-serif;background:#F5F5F7;color:#1D1D1F;display:grid;min-height:100vh;place-items:center;padding:24px">
<main style="max-width:420px;background:#fff;border-radius:16px;padding:28px;line-height:1.8">
<h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
<p style="margin:0 0 16px">${body}</p>
<h2 dir="ltr" style="font-size:16px;margin:0 0 8px;text-align:left">${titleEn}</h2>
<p dir="ltr" style="margin:0;text-align:left">${bodyEn}</p>${form}
</main></body></html>`;
};

const html = (state: State, action?: string) =>
  new Response(page(state, action), {
    status: state === "invalid" ? 400 : 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });

/**
 * The link in the email body: only shows a confirmation form. Mail scanners and link previewers
 * GET every link, so opening it must not change anything; the opt-out happens on POST.
 */
export async function GET(request: Request) {
  if (!signedUser(request)) return html("invalid");
  const url = new URL(request.url);
  return html("confirm", `${url.pathname}${url.search}`);
}

/** The confirm button, and RFC 8058 one-click from the List-Unsubscribe header (the client ignores the body). */
export async function POST(request: Request) {
  const userId = signedUser(request);
  if (!userId) return html("invalid");
  await db.user.updateMany({ where: { id: userId, emailOptOutAt: null }, data: { emailOptOutAt: new Date() } });
  return html("done");
}
