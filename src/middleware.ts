import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { DEVICE_COOKIE } from "./lib/device";

const intl = createMiddleware(routing);

export default function middleware(req: NextRequest) {
  // Pre-launch gate: when SITE_PASSWORD is set, every page asks for it (any username).
  // API routes are outside the matcher, so payment webhooks still get through.
  const password = process.env.SITE_PASSWORD;
  if (password) {
    const [scheme, encoded] = req.headers.get("authorization")?.split(" ") ?? [];
    const given = scheme === "Basic" && encoded ? atob(encoded).split(":").slice(1).join(":") : null;
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
  const res = home && signedIn ? NextResponse.rewrite(new URL(`/${home[1]}/me${req.nextUrl.search}`, req.url)) : intl(req);
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
