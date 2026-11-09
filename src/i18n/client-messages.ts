// The browser only needs the strings that client components read with useTranslations. Sending every namespace put
// the admin and teacher labels, and 64% more bytes, into every visitor's page. A test checks the lists below
// against the code, so a client component that reads a namespace not listed here fails the build, not a page.

/** Namespaces read by client components on public and signed-in pages. */
export const PUBLIC_CLIENT_NAMESPACES = [
  "common",
  "account",
  "nav",
  "errors",
  "teach",
  "signup",
  "verify",
  "reset",
  "questions",
  "assistant",
  "pwa",
  "parent",
  "invite",
  "forgot",
  "contactForm",
  "suggest",
  "otp",
  "checkout",
  "catalog",
] as const;

/** Added under /admin and /teacher, where the shared staff controls live. */
export const STAFF_CLIENT_NAMESPACES = ["admin", "office"] as const;

export function pickMessages(all: Record<string, unknown>, namespaces: readonly string[]) {
  return Object.fromEntries(namespaces.filter((n) => n in all).map((n) => [n, all[n]]));
}
