import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

// Pre-launch gate: when SITE_PASSWORD is set, every page asks for it (any username).
// API routes are outside the matcher, so payment webhooks still get through.
export default function middleware(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (password) {
    const [scheme, encoded] = req.headers.get("authorization")?.split(" ") ?? [];
    const given = scheme === "Basic" && encoded ? atob(encoded).split(":").slice(1).join(":") : null;
    if (given !== password) {
      return new NextResponse("Password required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Elhashash Academy", charset="UTF-8"' },
      });
    }
  }
  return intl(req);
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
