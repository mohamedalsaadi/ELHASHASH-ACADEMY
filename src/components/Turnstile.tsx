import Script from "next/script";
import { turnstileSiteKey } from "@/lib/turnstile";

/** The Turnstile widget. It adds a hidden `cf-turnstile-response` field to the surrounding form and only shows itself when Cloudflare needs a click. Renders nothing until the site key is set. */
export function Turnstile() {
  const key = turnstileSiteKey();
  if (!key) return null;
  return (
    <>
      <div className="cf-turnstile" data-sitekey={key} data-appearance="interaction-only" data-theme="auto" />
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
    </>
  );
}
