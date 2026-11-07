import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { DEVICE_COOKIE } from "./lib/device";

const intl = createMiddleware(routing);

// A real script policy. The App Router streams its payload in inline scripts, so `'self'` alone
// would break hydration; Next adds a nonce to every script it renders *when the request carries a
// CSP header containing one*. That is why the header is set on the request as well as the response.
// The dev server needs eval and inline for HMR; production allows neither.
const isDev = process.env.NODE_ENV !== "production";

function policy(nonce: string) {
  return [
    "default-src 'self'",
    // 'self' covers our own files (including /intro-guard.js); the nonce covers the App Router's
    // inline payload scripts. Deliberately not 'strict-dynamic': it would block our non-nonced file.
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval' 'unsafe-inline'" : ""}`,
    // Inline style attributes carry the country trail colours and the meter widths.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "frame-src https://www.youtube-nocookie.com https://player.vdocipher.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export default function middleware(req: NextRequest) {
  // Pre-launch gate: when SITE_PASSWORD is set, every page asks for it (any username).
  // API routes are outside the matcher, so payment webhooks still get through.
  const password = process.env.SITE_PASSWORD;
  if (password) {
    const [scheme, encoded] = req.headers.get("authorization")?.split(" ") ?? [];
    // atob throws on malformed base64; a bad header is a failed attempt, not a server error.
    let given: string | null = null;
    if (scheme === "Basic" && encoded) {
      try {
        given = atob(encoded).split(":").slice(1).join(":");
      } catch {
        given = null;
      }
    }
    if (given !== password) {
      return new NextResponse("Password required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Dhirwa", charset="UTF-8"' },
      });
    }
  }

  // Per-browser id for the one-device rule on the secure player. Every sign-in passes through
  // a page first, so the cookie is in place before any protected video is requested.
  // Signed-in visitors get the student home at the same address. The page re-checks the session and role, and
  // shows the public home to anyone else, so a stale cookie only costs a dynamic render.
  const home = /^\/(ar|en)\/?$/.exec(req.nextUrl.pathname);
  const signedIn = req.cookies.has("authjs.session-token") || req.cookies.has("__Secure-authjs.session-token");

  // One nonce per document. It is put on the request so Next stamps its own inline scripts with it,
  // and on the response so the browser enforces the same policy.
  const nonce = btoa(crypto.randomUUID());
  const csp = policy(nonce);
  const headers = new Headers(req.headers);
  headers.set("content-security-policy", csp);
  headers.set("x-nonce", nonce);
  // The signed-in rewrite below skips the intl middleware, which normally sets this. Without it next-intl can resolve
  // the locale before setRequestLocale runs, and the whole English page comes out in the default language.
  if (home) headers.set("X-NEXT-INTL-LOCALE", home[1]);
  const withCsp = new NextRequest(req, { headers });

  const res = home && signedIn
    ? NextResponse.rewrite(new URL(`/${home[1]}/me${req.nextUrl.search}`, req.url), { request: { headers } })
    : intl(withCsp);
  // The policy goes on the document; /api and static files are outside the matcher.
  res.headers.set("Content-Security-Policy", csp);
  if (!req.cookies.has(DEVICE_COOKIE)) {
    res.cookies.set(DEVICE_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      secure: req.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 2,
    });
  }
  return res;
}

export const config = {
  // Generated brand images have no file extension, so they are excluded by name.
  matcher: "/((?!api|_next|_vercel|apple-icon|opengraph-image|.*\\..*).*)",
};
