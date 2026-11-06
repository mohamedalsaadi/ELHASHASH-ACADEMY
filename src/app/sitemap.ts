import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/seo";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [countries, courses, subjectRows, teachers] = await Promise.all([
    db.country.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      select: { code: true, grades: { where: { active: true }, select: { level: true } } },
    }),
    db.course.findMany({ where: { published: true }, select: { slug: true, createdAt: true } }),
    // Subject pages are the highest-intent public pages after the course pages themselves.
    db.course.findMany({
      where: { published: true, kind: "SCHOOL" },
      select: {
        gradeId: true,
        subjectId: true,
        subject: { select: { slug: true, active: true } },
        grade: { select: { level: true, active: true, country: { select: { code: true, active: true } } } },
      },
      distinct: ["gradeId", "subjectId"],
    }),
    db.user.findMany({
      where: { role: { in: ["INSTRUCTOR", "ADMIN"] }, courses: { some: { published: true } } },
      select: { id: true },
    }),
  ]);

  const languages = (path: string) => ({ ar: `${siteUrl}/ar${path}`, en: `${siteUrl}/en${path}`, "x-default": `${siteUrl}/ar${path}` });
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of ["ar", "en"]) {
    for (const path of ["", "/courses", "/teach", "/contact", "/faq", "/privacy", "/terms", "/refund", "/accessibility"]) {
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

    for (const row of subjectRows) {
      const country = row.grade?.country;
      if (!country?.active || !row.grade?.active || !row.subject?.active) continue;
      const path = `/courses/c/${country.code.toLowerCase()}/${row.grade.level}/${row.subject.slug}`;
      entries.push({ url: `${siteUrl}/${locale}${path}`, changeFrequency: "weekly", priority: 0.7, alternates: { languages: languages(path) } });
    }

    for (const teacher of teachers) {
      const path = `/teachers/${teacher.id}`;
      entries.push({ url: `${siteUrl}/${locale}${path}`, changeFrequency: "weekly", priority: 0.5, alternates: { languages: languages(path) } });
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
