import { z } from "zod";

const checkbox = z.literal("on").optional().transform(Boolean);

export const countryCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "bad_code");

/** A real IANA zone such as Asia/Dubai; `Intl` rejects unknown names. */
export const timeZoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((zone) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: zone });
      return true;
    } catch {
      return false;
    }
  }, "bad_timezone");

export const currencySchema = z.enum(["EGP", "SAR", "AED", "KWD", "QAR", "BHD", "OMR"]);
export const curriculumSchema = z.enum(["NATIONAL_EG", "MOE", "BRITISH", "AMERICAN", "IB"]);
export const levelSchema = z.coerce.number().int().min(1).max(12);
export const subjectSlugSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "bad_slug");

export const countryInput = z.object({
  id: z.string().optional(),
  code: countryCodeSchema,
  nameAr: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().min(1).max(80),
  currency: currencySchema,
  timeZone: timeZoneSchema,
  order: z.coerce.number().int().min(0).max(999).default(0),
  active: checkbox,
  vatEnabled: checkbox,
  vatRate: z.coerce.number().min(0).max(50).default(5),
  vatTrn: z.string().trim().max(40).default(""),
});

export const stageInput = z
  .object({
    id: z.string().optional(),
    countryId: z.string().min(1),
    nameAr: z.string().trim().min(1).max(80),
    nameEn: z.string().trim().min(1).max(80),
    fromLevel: levelSchema,
    toLevel: levelSchema,
    order: z.coerce.number().int().min(0).max(999).default(0),
  })
  .refine((s) => s.fromLevel <= s.toLevel, { path: ["toLevel"], message: "bad_range" });

export const gradeInput = z.object({
  id: z.string().optional(),
  countryId: z.string().min(1),
  curriculum: curriculumSchema,
  level: levelSchema,
  track: z.enum(["GENERAL", "ADVANCED"]).default("GENERAL"),
  nameAr: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().min(1).max(80),
  isTerminal: checkbox,
  order: z.coerce.number().int().min(0).max(999).default(0),
  active: checkbox,
});

export const subjectInput = z.object({
  id: z.string().optional(),
  slug: subjectSlugSchema,
  nameAr: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().min(1).max(80),
  icon: z.string().trim().min(1).max(40),
  active: checkbox,
});

export const rangesOverlap = (a: { fromLevel: number; toLevel: number }, b: { fromLevel: number; toLevel: number }) =>
  a.fromLevel <= b.toLevel && b.fromLevel <= a.toLevel;
