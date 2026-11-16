// Kept apart from turnstile.ts so the browser widget can read the site key without pulling the server-only verify code (and the database) into its bundle.
export const turnstileSiteKey = () => process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
export const turnstileEnabled = () => !!turnstileSiteKey() && !!process.env.TURNSTILE_SECRET_KEY;
