import { db } from "@/lib/db";
import { verifyUnsubscribe } from "@/lib/unsubscribe";

/** Records the opt-out when the signed link is genuine. Returns false for anything else. */
async function optOut(request: Request): Promise<boolean> {
  const params = new URL(request.url).searchParams;
  const userId = params.get("u") ?? "";
  const sig = params.get("s") ?? "";
  if (!userId || !sig || !verifyUnsubscribe(userId, sig)) return false;
  await db.user.updateMany({ where: { id: userId, emailOptOutAt: null }, data: { emailOptOutAt: new Date() } });
  return true;
}

const page = (ok: boolean) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>ذروة</title></head>
<body style="margin:0;font-family:Tahoma,Arial,sans-serif;background:#F5F5F7;color:#1D1D1F;display:grid;min-height:100vh;place-items:center;padding:24px">
<main style="max-width:420px;background:#fff;border-radius:16px;padding:28px;line-height:1.8">
<h1 style="font-size:20px;margin:0 0 12px">${ok ? "أوقفنا الرسائل الاختيارية" : "الرابط غير صالح"}</h1>
<p style="margin:0 0 16px">${ok ? "لن تصلك رسائل التذكير والتنبيهات بعد الآن. إيصالات الدفع ورسائل أمان الحساب ستصلك دائمًا." : "تعذّر التحقق من الرابط. افتح حسابك وأوقف الرسائل من صفحة الحساب."}</p>
<h2 dir="ltr" style="font-size:16px;margin:0 0 8px;text-align:left">${ok ? "Optional emails are off" : "This link is not valid"}</h2>
<p dir="ltr" style="margin:0;text-align:left">${ok ? "You will no longer get reminders or updates. Payment receipts and account security emails always reach you." : "We could not check this link. Open your account and turn optional emails off there."}</p>
</main></body></html>`;

/** The link in the email body: opens a confirmation page. */
export async function GET(request: Request) {
  const ok = await optOut(request);
  return new Response(page(ok), {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

/** RFC 8058 one-click: the mail client posts here from the List-Unsubscribe header. */
export async function POST(request: Request) {
  return new Response(null, { status: (await optOut(request)) ? 200 : 400 });
}
