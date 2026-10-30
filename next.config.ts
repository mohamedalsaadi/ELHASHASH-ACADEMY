import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// HSTS belongs on the real origin only: pinning http://localhost in a dev browser is a nuisance to undo.
const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : []),
          // Camera, microphone and screen sharing only for the Daily live-lecture frame.
          { key: "Permissions-Policy", value: 'camera=("https://*.daily.co"), microphone=("https://*.daily.co"), display-capture=("https://*.daily.co"), geolocation=()' },
          // Only framing rules for now: nobody may embed the site, and it embeds only the two video players and Daily.
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; frame-src https://www.youtube-nocookie.com https://player.vdocipher.com https://*.daily.co",
          },
        ],
      },
    ];
  },
};

export default createNextIntlPlugin()(nextConfig);
