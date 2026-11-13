// Cloudflare Turnstile: a free, mostly invisible bot check on the forms that create accounts or send mail to the owner.
// Off until both keys are set, so local dev, e2e and preview builds are unchanged.
export const turnstileSiteKey = () => process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
export const turnstileEnabled = () => !!turnstileSiteKey() && !!process.env.TURNSTILE_SECRET_KEY;

/**
 * True when the visitor passed the check, or when the check is off. An explicit refusal from Cloudflare is a no; if Cloudflare
 * itself cannot be reached the form stays open (a real person is never locked out by someone else's outage), and the existing
 * per-address limits still apply.
 */
export async function verifyTurnstile(token: string | null | undefined, ip?: string): Promise<boolean> {
  if (!turnstileEnabled()) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token, ...(ip ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return true;
    return ((await res.json()) as { success?: boolean }).success === true;
  } catch {
    return true;
  }
}
