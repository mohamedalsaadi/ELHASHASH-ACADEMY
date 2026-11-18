import { NextResponse } from "next/server";
import { CODE_RE, normalizeCode } from "@/lib/coupons";
import { REFERRAL_COOKIE, REFERRAL_COOKIE_DAYS } from "@/lib/referral";

/**
 * A friend's invitation link, `/{locale}/r/{code}`. It remembers the sender for 30 days and opens the catalogue.
 * Nothing is credited here: the checkout decides, because only a friend's first paid order counts.
 */
export async function GET(req: Request, { params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code } = await params;
  const origin = process.env.APP_URL || new URL(req.url).origin;
  const res = NextResponse.redirect(new URL(`/${locale === "en" ? "en" : "ar"}/courses`, origin));
  const clean = normalizeCode(decodeURIComponent(code));
  if (CODE_RE.test(clean)) {
    res.cookies.set(REFERRAL_COOKIE, clean, {
      httpOnly: true,
      secure: new URL(req.url).protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * REFERRAL_COOKIE_DAYS,
    });
  }
  return res;
}
