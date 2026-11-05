import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/*/admin",
          "/*/dashboard",
          "/*/teacher",
          "/*/parent",
          "/*/checkout",
          "/*/orders",
          "/*/account",
          "/*/notifications",
          "/*/live",
          "/*/signin",
          "/*/signup",
          "/*/forgot",
          "/*/reset",
          "/*/verify",
          "/*/offline",
          "/*/me",
          "/*/review",
          "/*/invite",
          "/api",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
