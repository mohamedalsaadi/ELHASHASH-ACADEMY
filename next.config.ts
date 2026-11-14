import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// HSTS belongs on the real origin only: pinning http://localhost in a dev browser is a nuisance to undo.
const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Covers are private blobs behind /api/covers; the optimizer resizes them to the card or page and caches the result.
  images: { localPatterns: [{ pathname: "/api/covers/**" }, { pathname: "/flags/**" }] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          ...(isProduction
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }]
            : []),
          // Camera, microphone and screen sharing are not granted to anyone: live lectures open an
          // external meeting, so this page never needs them.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), display-capture=(), payment=(), usb=(), geolocation=()" },
          // The Content-Security-Policy is set per request in src/middleware.ts, where the
          // development server's needs can differ from production's.
        ],
      },
    ];
  },
};

export default createNextIntlPlugin()(nextConfig);
