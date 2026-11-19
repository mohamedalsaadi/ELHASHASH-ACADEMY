import { auth } from "@/auth";
import { appUrl } from "@/lib/mail";
import { adRoles, getReferralAd } from "@/lib/referral-ad";
import { getOrCreateReferralCode } from "@/lib/referral";

const headers = { "Cache-Control": "no-store" };

/**
 * What the home page's invite-a-friend popup needs. The home page is cached for everyone, so the popup asks here instead of
 * the page reading the session. `{ enabled: false }` when the admin switch is off, the reward is zero, or the visitor is a
 * teacher or admin. A signed-in student or parent also gets their own link; a visitor gets none.
 */
export async function GET(request: Request) {
  const { enabled, percent } = await getReferralAd();
  if (!enabled) return Response.json({ enabled: false }, { headers });
  const session = await auth();
  const role = session?.user?.role;
  if (session?.user && !adRoles(role)) return Response.json({ enabled: false }, { headers });

  const locale = new URL(request.url).searchParams.get("locale") === "en" ? "en" : "ar";
  let link: string | null = null;
  if (session?.user && (role === "STUDENT" || role === "PARENT")) {
    const { code } = await getOrCreateReferralCode(session.user.id);
    link = `${appUrl()}/${locale}/r/${code}`;
  }
  return Response.json({ enabled: true, percent, link }, { headers });
}
