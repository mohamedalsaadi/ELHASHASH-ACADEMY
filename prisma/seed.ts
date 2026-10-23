// Development seed: a small Egyptian Grade 12 catalog, one bundle rule and a test student.
// Prices are placeholders in fils, AED only for now (30000 = 300 AED); set real ones from the admin later.
// Test login (dev only): phone 01000000001, password from SEED_STUDENT_PASSWORD or "elhashash-dev-1234".
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

config({ path: ".env.local" });
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const eg = await db.country.upsert({
    where: { code: "EG" },
    update: {},
    create: { code: "EG", nameAr: "مصر", nameEn: "Egypt", currency: "EGP" },
  });

  const grades = [
    { level: 10, nameAr: "الصف الأول الثانوي", nameEn: "Secondary 1" },
    { level: 11, nameAr: "الصف الثاني الثانوي", nameEn: "Secondary 2" },
    { level: 12, nameAr: "الصف الثالث الثانوي (الثانوية العامة)", nameEn: "Secondary 3 (Thanawya Amma)" },
  ];
  for (const g of grades) {
    await db.grade.upsert({
      where: { countryId_curriculum_level: { countryId: eg.id, curriculum: "NATIONAL_EG", level: g.level } },
      update: {},
      create: { ...g, countryId: eg.id, curriculum: "NATIONAL_EG", isTerminal: g.level === 12 },
    });
  }
  const g12 = await db.grade.findUniqueOrThrow({
    where: { countryId_curriculum_level: { countryId: eg.id, curriculum: "NATIONAL_EG", level: 12 } },
  });

  const subjects = [
    { slug: "math", nameAr: "الرياضيات", nameEn: "Mathematics" },
    { slug: "physics", nameAr: "الفيزياء", nameEn: "Physics" },
    { slug: "chemistry", nameAr: "الكيمياء", nameEn: "Chemistry" },
  ];
  for (const s of subjects) await db.subject.upsert({ where: { slug: s.slug }, update: {}, create: s });
  const bySlug = Object.fromEntries((await db.subject.findMany()).map((s) => [s.slug, s]));

  const password = process.env.SEED_STUDENT_PASSWORD ?? "elhashash-dev-1234";
  const instructor = await db.user.upsert({
    where: { phone: "01000000000" },
    update: {},
    create: { name: "Elhashash", phone: "01000000000", role: "INSTRUCTOR", passwordHash: await bcrypt.hash(password, 10) },
  });
  await db.user.upsert({
    where: { phone: "01000000001" },
    update: {},
    create: { name: "Test Student", phone: "01000000001", gradeId: g12.id, passwordHash: await bcrypt.hash(password, 10) },
  });

  const semesterEnd = new Date("2027-01-31T21:59:59Z");
  const yearEnd = new Date("2027-07-15T20:59:59Z");
  for (const s of subjects) {
    const slug = `eg-12-${s.slug}`;
    const course = await db.course.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        gradeId: g12.id,
        subjectId: bySlug[s.slug].id,
        instructorId: instructor.id,
        titleAr: `${s.nameAr}، الثانوية العامة`,
        titleEn: `${s.nameEn}, Thanawya Amma`,
        published: true,
        units: {
          create: [
            { order: 1, titleAr: "الوحدة الأولى: الأساسيات", titleEn: "Unit 1: Fundamentals", isFree: true },
            { order: 2, titleAr: "الوحدة الثانية", titleEn: "Unit 2" },
          ],
        },
      },
    });
    const skus = [
      { accessType: "SEMESTER", price: 30000, accessEndsAt: semesterEnd },
      { accessType: "YEARLY", price: 50000, accessEndsAt: yearEnd },
      {
        accessType: "REVISION",
        price: 15000,
        saleFrom: new Date("2027-05-01T00:00:00Z"),
        saleTo: new Date("2027-07-01T00:00:00Z"),
        accessEndsAt: yearEnd,
      },
    ] as const;
    // Three placeholder lessons per unit; videos are attached later from the admin.
    const lessons = [
      { order: 1, kind: "VIDEO", titleAr: "شرح الوحدة", titleEn: "Unit walkthrough" },
      { order: 2, kind: "EXAM_STRUCTURE", titleAr: "شرح الهيكل", titleEn: "Exam structure" },
      { order: 3, kind: "PAST_QUESTIONS", titleAr: "أسئلة الوزارة السابقة", titleEn: "Past ministry questions" },
    ] as const;
    for (const unit of await db.unit.findMany({ where: { courseId: course.id } })) {
      for (const l of lessons) {
        await db.lesson.upsert({
          where: { unitId_order: { unitId: unit.id, order: l.order } },
          update: {},
          create: { ...l, unitId: unit.id },
        });
      }
    }

    // Update in place: SKUs already on orders can't be deleted.
    for (const s of skus) {
      const existing = await db.sku.findFirst({ where: { courseId: course.id, accessType: s.accessType } });
      const data = { ...s, courseId: course.id, currency: "AED" as const };
      if (existing) await db.sku.update({ where: { id: existing.id }, data });
      else await db.sku.create({ data });
    }
  }

  if ((await db.bundleRule.count()) === 0) {
    await db.bundleRule.create({
      data: {
        name: "Math + Physics",
        percentOff: 15,
        subjects: { connect: [{ id: bySlug.math.id }, { id: bySlug.physics.id }] },
      },
    });
  }
}

main()
  .then(() => console.log("Seeded."))
  .finally(() => db.$disconnect());
