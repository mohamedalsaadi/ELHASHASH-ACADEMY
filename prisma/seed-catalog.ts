// Catalog seed: the 7 countries, grades 1–12 in each, the subject list and default subjects per grade.
// Safe on the shared database: upserts only, grades keep their ids, and a grade's subject list is seeded
// only while it is empty, so the owner's edits in admin are never undone. Run: npx tsx prisma/seed-catalog.ts
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

config({ path: ".env.local" });
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const COUNTRIES = [
  { code: "EG", nameAr: "مصر", nameEn: "Egypt", currency: "EGP", timeZone: "Africa/Cairo" },
  { code: "SA", nameAr: "السعودية", nameEn: "Saudi Arabia", currency: "SAR", timeZone: "Asia/Riyadh" },
  { code: "AE", nameAr: "الإمارات", nameEn: "UAE", currency: "AED", timeZone: "Asia/Dubai" },
  { code: "KW", nameAr: "الكويت", nameEn: "Kuwait", currency: "KWD", timeZone: "Asia/Kuwait" },
  { code: "QA", nameAr: "قطر", nameEn: "Qatar", currency: "QAR", timeZone: "Asia/Qatar" },
  { code: "BH", nameAr: "البحرين", nameEn: "Bahrain", currency: "BHD", timeZone: "Asia/Bahrain" },
  { code: "OM", nameAr: "عُمان", nameEn: "Oman", currency: "OMR", timeZone: "Asia/Muscat" },
] as const;

// Default stage groups, same as the values already in production. The owner edits them in admin.
const STAGES: Record<string, { from: number; to: number; ar: string; en: string }[]> = {
  EG: [
    { from: 1, to: 6, ar: "المرحلة الابتدائية", en: "Primary" },
    { from: 7, to: 9, ar: "المرحلة الإعدادية", en: "Preparatory" },
    { from: 10, to: 12, ar: "المرحلة الثانوية", en: "Secondary" },
  ],
  SA: [
    { from: 1, to: 6, ar: "المرحلة الابتدائية", en: "Primary" },
    { from: 7, to: 9, ar: "المرحلة المتوسطة", en: "Intermediate" },
    { from: 10, to: 12, ar: "المرحلة الثانوية", en: "Secondary" },
  ],
  BH: [
    { from: 1, to: 6, ar: "المرحلة الابتدائية", en: "Primary" },
    { from: 7, to: 9, ar: "المرحلة الإعدادية", en: "Intermediate" },
    { from: 10, to: 12, ar: "المرحلة الثانوية", en: "Secondary" },
  ],
  QA: [
    { from: 1, to: 6, ar: "المرحلة الابتدائية", en: "Primary" },
    { from: 7, to: 9, ar: "المرحلة الإعدادية", en: "Preparatory" },
    { from: 10, to: 12, ar: "المرحلة الثانوية", en: "Secondary" },
  ],
  KW: [
    { from: 1, to: 5, ar: "المرحلة الابتدائية", en: "Primary" },
    { from: 6, to: 9, ar: "المرحلة المتوسطة", en: "Intermediate" },
    { from: 10, to: 12, ar: "المرحلة الثانوية", en: "Secondary" },
  ],
  AE: [
    { from: 1, to: 4, ar: "الحلقة الأولى", en: "Cycle 1" },
    { from: 5, to: 8, ar: "الحلقة الثانية", en: "Cycle 2" },
    { from: 9, to: 12, ar: "الحلقة الثالثة", en: "Cycle 3" },
  ],
  OM: [
    { from: 1, to: 4, ar: "الحلقة الأولى", en: "Cycle 1" },
    { from: 5, to: 10, ar: "الحلقة الثانية", en: "Cycle 2" },
    { from: 11, to: 12, ar: "ما بعد الأساسي", en: "Post-basic" },
  ],
};

const ORDINAL = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر"];
const PER_STAGE: Record<string, [string, string, string]> = {
  EG: ["الابتدائي", "الإعدادي", "الثانوي"],
  SA: ["الابتدائي", "المتوسط", "الثانوي"],
  BH: ["الابتدائي", "الإعدادي", "الثانوي"],
};

/** Seed-only grade names; the public pages read the owner's Grade names from the database. */
function gradeName(country: string, level: number): { nameAr: string; nameEn: string } {
  const stages = STAGES[country];
  const words = PER_STAGE[country];
  if (!stages || !words) return { nameAr: `الصف ${ORDINAL[level - 1]}`, nameEn: `Grade ${level}` };
  const i = stages.findIndex((s) => level >= s.from && level <= s.to);
  const stage = stages[i];
  const n = level - stage.from + 1;
  return { nameAr: `الصف ${ORDINAL[n - 1]} ${words[i]}`, nameEn: `${stage.en} ${n}` };
}

// Slug, names, icon key. Existing slugs (math, physics, chemistry) keep their names.
const SUBJECTS = [
  ["arabic", "اللغة العربية", "Arabic", "arabic"],
  ["english", "اللغة الإنجليزية", "English", "english"],
  ["french", "اللغة الفرنسية", "French", "french"],
  ["math", "الرياضيات", "Mathematics", "math"],
  ["science", "العلوم", "Science", "science"],
  ["physics", "الفيزياء", "Physics", "physics"],
  ["chemistry", "الكيمياء", "Chemistry", "chemistry"],
  ["biology", "الأحياء", "Biology", "biology"],
  ["islamic", "التربية الإسلامية", "Islamic Education", "islamic"],
  ["social-studies", "الدراسات الاجتماعية", "Social Studies", "social"],
  ["history", "التاريخ", "History", "history"],
  ["geography", "الجغرافيا", "Geography", "geography"],
  ["philosophy", "الفلسفة والمنطق", "Philosophy & Logic", "philosophy"],
  ["psychology", "علم النفس", "Psychology", "psychology"],
  ["economics", "الاقتصاد", "Economics", "economics"],
  ["ict", "الحاسب الآلي", "Computer Science", "ict"],
  ["statistics", "الإحصاء", "Statistics", "statistics"],
  ["art", "التربية الفنية", "Art", "art"],
  ["pe", "التربية البدنية", "Physical Education", "pe"],
] as const;

/** Starting subject list per grade; the owner edits it in admin. */
function defaultSubjects(country: string, level: number): string[] {
  if (level <= 6) return ["arabic", "english", "math", "science", "islamic", ...(level >= 4 ? ["social-studies", "ict"] : [])];
  if (level <= 9) return ["arabic", "english", "french", "math", "science", "social-studies", "islamic", "ict"];
  return [
    "arabic", "english", "french", "math", "physics", "chemistry", "biology", "islamic", "history", "geography", "economics", "ict",
    ...(country === "EG" ? ["philosophy", "psychology"] : []),
  ];
}

async function main() {
  for (const [slug, nameAr, nameEn, icon] of SUBJECTS) {
    await db.subject.upsert({ where: { slug }, update: { icon }, create: { slug, nameAr, nameEn, icon } });
  }
  const subjectId = Object.fromEntries((await db.subject.findMany()).map((s) => [s.slug, s.id]));

  for (const [i, c] of COUNTRIES.entries()) {
    const country = await db.country.upsert({
      where: { code: c.code },
      update: { nameAr: c.nameAr, nameEn: c.nameEn, currency: c.currency, timeZone: c.timeZone, order: i + 1 },
      create: { ...c, order: i + 1 },
    });
    for (const [order, stage] of (STAGES[c.code] ?? []).entries()) {
      await db.stage.upsert({
        where: { countryId_fromLevel: { countryId: country.id, fromLevel: stage.from } },
        update: {},
        create: { countryId: country.id, nameAr: stage.ar, nameEn: stage.en, fromLevel: stage.from, toLevel: stage.to, order },
      });
    }
    const curriculum = c.code === "EG" ? "NATIONAL_EG" : "MOE";
    for (let level = 1; level <= 12; level++) {
      const names = gradeName(c.code, level);
      const isTerminal = c.code === "EG" && level === 12;
      const grade = await db.grade.upsert({
        where: { countryId_curriculum_level: { countryId: country.id, curriculum, level } },
        update: { ...names, isTerminal },
        create: { ...names, isTerminal, countryId: country.id, curriculum, level, order: level },
      });
      if ((await db.gradeSubject.count({ where: { gradeId: grade.id } })) === 0) {
        await db.gradeSubject.createMany({
          data: defaultSubjects(c.code, level).map((slug, order) => ({ gradeId: grade.id, subjectId: subjectId[slug], order })),
        });
      }
    }
  }

  // Every existing school course must show as a tile in its grade.
  const courses = await db.course.findMany({ where: { gradeId: { not: null }, subjectId: { not: null } } });
  for (const c of courses) {
    const key = { gradeId: c.gradeId!, subjectId: c.subjectId! };
    const order = await db.gradeSubject.count({ where: { gradeId: key.gradeId } });
    await db.gradeSubject.upsert({ where: { gradeId_subjectId: key }, update: {}, create: { ...key, order } });
  }
}

main()
  .then(async () => {
    const [countries, stages, grades, links] = await Promise.all([db.country.count(), db.stage.count(), db.grade.count(), db.gradeSubject.count()]);
    console.log(`Catalog seeded: ${countries} countries, ${stages} stages, ${grades} grades, ${links} grade subjects.`);
  })
  .finally(() => db.$disconnect());
