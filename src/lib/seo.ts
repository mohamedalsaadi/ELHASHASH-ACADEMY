import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/** Absolute site origin for metadata, sitemaps and structured data. */
export const siteUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");

/** Canonical path plus the ar/en alternates for one page. Relative paths resolve against metadataBase. */
export function alternates(locale: string, path = "") {
  const bare = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return {
    canonical: `/${locale}${bare}`,
    languages: { ar: `/ar${bare}`, en: `/en${bare}`, "x-default": `/ar${bare}` },
  };
}

/**
 * Metadata for one page, titled from the message catalog so the tab, the history entry and
 * the screen-reader announcement all match the screen.
 *
 * Private screens pass `noindex`: they get no canonical or hreflang, because a search result
 * pointing at a receipt is a leak, not a landing page.
 */
export async function pageMetadata(
  params: Promise<{ locale: string }>,
  path: string,
  namespace: string,
  opts: { key?: string; description?: string; noindex?: boolean } = {},
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace });
  return {
    title: t(opts.key ?? "title"),
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.noindex ? { robots: { index: false, follow: false } } : { alternates: alternates(locale, path) }),
  };
}
