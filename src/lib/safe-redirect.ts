/**
 * Accepts only same-site paths for post-sign-in redirects. Browsers read "\" as "/", so
 * "/\evil.com" would leave the site; any backslash or control character is rejected too.
 */
export function safeNext(next: unknown, fallback: string): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}
