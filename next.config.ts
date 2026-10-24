import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
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
