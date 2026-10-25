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
