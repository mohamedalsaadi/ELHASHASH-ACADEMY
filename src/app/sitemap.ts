import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/seo";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [countries, courses] = await Promise.all([
    db.country.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      select: { code: true, grades: { where: { active: true }, select: { level: true } } },
    }),
    db.course.findMany({ where: { published: true }, select: { slug: true, createdAt: true } }),
  ]);

  const languages = (path: string) => ({ ar: `${siteUrl}/ar${path}`, en: `${siteUrl}/en${path}`, "x-default": `${siteUrl}/ar${path}` });
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of ["ar", "en"]) {
    for (const path of ["", "/courses", "/contact", "/faq", "/privacy", "/terms", "/refund"]) {
      entries.push({
        url: `${siteUrl}/${locale}${path}`,
        changeFrequency: "weekly",
        priority: path === "" ? 1 : 0.7,
        alternates: { languages: languages(path) },
      });
    }

    for (const country of countries) {
      const path = `/courses/c/${country.code.toLowerCase()}`;
      entries.push({ url: `${siteUrl}/${locale}${path}`, changeFrequency: "weekly", priority: 0.8, alternates: { languages: languages(path) } });
      for (const level of new Set(country.grades.map((g) => g.level))) {
        const gradePath = `${path}/${level}`;
        entries.push({
          url: `${siteUrl}/${locale}${gradePath}`,
          changeFrequency: "weekly",
          priority: 0.6,
          alternates: { languages: languages(gradePath) },
        });
      }
    }

    for (const course of courses) {
      const path = `/courses/${course.slug}`;
      entries.push({
        url: `${siteUrl}/${locale}${path}`,
        lastModified: course.createdAt,
        changeFrequency: "weekly",
        priority: 0.8,
        alternates: { languages: languages(path) },
      });
    }
  }

  return entries;
}
