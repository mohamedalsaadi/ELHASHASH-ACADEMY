import { z } from "zod";

/** A subject's slug from its English name; the teacher never types one. */
export const subjectSlugFrom = (nameEn: string) =>
  nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "subject";

/** A teacher adding a subject to grades of one of their countries. */
export const teacherSubjectInput = z.object({
  countryId: z.string().min(1),
  nameAr: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().min(1).max(80),
  icon: z.string().trim().min(1).max(40),
  gradeIds: z.array(z.string().min(1)).min(1).max(40),
});

export const countryRequestInput = z.object({
  countryId: z.string().min(1),
  note: z.string().trim().max(500).default(""),
});
