// Test personas for the end-to-end suite, on top of prisma/seed.ts (Egypt Grade 12 catalog). Run only by
// scripts/e2e.mjs, against its throwaway database; it refuses any other DATABASE_URL.
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PASSWORD, PERSONAS } from "./personas";

const url = process.env.DATABASE_URL ?? "";
if (!url.includes("@localhost:54329/dhirwa_e2e")) throw new Error("e2e seed runs only on the throwaway e2e database");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const eg = await db.country.findUniqueOrThrow({ where: { code: "EG" } });
  const ae = await db.country.upsert({
    where: { code: "AE" },
    update: {},
    create: { code: "AE", nameAr: "الإمارات", nameEn: "UAE", currency: "AED", order: 1 },
  });
  const eg12 = await db.grade.findFirstOrThrow({ where: { countryId: eg.id, level: 12 } });
  const ae12 = await db.grade.upsert({
    where: { countryId_curriculum_level_track: { countryId: ae.id, curriculum: "MOE", level: 12, track: "GENERAL" } },
    update: {},
    create: { countryId: ae.id, curriculum: "MOE", level: 12, nameAr: "الصف الثاني عشر", nameEn: "Grade 12", isTerminal: true },
  });
  const subjects = await db.subject.findMany();
  for (const [i, s] of subjects.entries()) {
    for (const g of [eg12, ae12]) {
      await db.gradeSubject.upsert({
        where: { gradeId_subjectId: { gradeId: g.id, subjectId: s.id } },
        update: {},
        create: { gradeId: g.id, subjectId: s.id, order: i },
      });
    }
  }

  const user = (p: (typeof PERSONAS)[keyof typeof PERSONAS], gradeId?: string) =>
    db.user.upsert({
      where: { phone: p.phone },
      update: { passwordHash: hash, role: p.role, gradeId },
      create: { name: p.name, phone: p.phone, role: p.role, gradeId, passwordHash: hash },
    });
  await user(PERSONAS.admin);
  const teacherEg = await user(PERSONAS.teacherEg);
  const teacherAe = await user(PERSONAS.teacherAe);
  const studentEg = await user(PERSONAS.studentEg, eg12.id);
  const studentAe = await user(PERSONAS.studentAe, ae12.id);
  await user(PERSONAS.studentAe2, ae12.id);
  const parent = await user(PERSONAS.parent);

  for (const [t, c] of [[teacherEg, eg], [teacherAe, ae]] as const) {
    await db.teacherCountry.upsert({
      where: { userId_countryId: { userId: t.id, countryId: c.id } },
      update: {},
      create: { userId: t.id, countryId: c.id },
    });
  }
  const math = subjects.find((s) => s.slug === "math")!;
  await db.teacherSlot.upsert({
    where: { userId_gradeId_subjectId: { userId: teacherAe.id, gradeId: ae12.id, subjectId: math.id } },
    update: {},
    create: { userId: teacherAe.id, gradeId: ae12.id, subjectId: math.id },
  });
  await db.course.upsert({
    where: { slug: "ae-12-math-e2e" },
    update: {},
    create: {
      slug: "ae-12-math-e2e",
      gradeId: ae12.id,
      subjectId: math.id,
      instructorId: teacherAe.id,
      titleAr: "الرياضيات، الصف الثاني عشر",
      titleEn: "Mathematics, Grade 12",
      published: true,
      skus: { create: [{ accessType: "SEMESTER", price: 40000, currency: "AED", accessEndsAt: new Date("2027-01-31T21:59:59Z") }] },
    },
  });
  await db.parentLink.upsert({
    where: { parentId_studentId: { parentId: parent.id, studentId: studentEg.id } },
    update: {},
    create: { parentId: parent.id, studentId: studentEg.id },
  });
  // A second published course on the same grade and subject, by another teacher, so the subject page
  // has two instructors to compare. Also gives that teacher a public profile page.
  await db.course.upsert({
    where: { slug: "ae-12-math-second" },
    update: {},
    create: {
      slug: "ae-12-math-second",
      gradeId: ae12.id,
      subjectId: math.id,
      instructorId: teacherEg.id,
      titleAr: "الرياضيات، الصف الثاني عشر — شعبة ثانية",
      titleEn: "Mathematics, Grade 12 — second section",
      published: true,
      units: {
        create: [
          {
            order: 1,
            titleAr: "الوحدة الأولى",
            titleEn: "Unit 1",
            term: 1,
            lessons: {
              create: [
                { order: 1, kind: "VIDEO", titleAr: "درس تجريبي", titleEn: "Sample lesson" },
                { order: 2, kind: "VIDEO", titleAr: "درس تجريبي ثانٍ", titleEn: "Second sample lesson" },
              ],
            },
          },
        ],
      },
    },
  });
  // The UAE student too, so the parent can record consent for the student who holds a live seat.
  await db.parentLink.upsert({
    where: { parentId_studentId: { parentId: parent.id, studentId: studentAe.id } },
    update: {},
    create: { parentId: parent.id, studentId: studentAe.id },
  });

  // A published exam on the main UAE course, so the "an exam needs a plan" rule has something to
  // protect. Fresh database each run, so plain creates are safe here.
  const aeCourse = await db.course.findUniqueOrThrow({ where: { slug: "ae-12-math-e2e" } });
  await db.examPaper.deleteMany({ where: { courseId: aeCourse.id } });
  await db.unit.deleteMany({ where: { courseId: aeCourse.id } });
  const examUnit = await db.unit.create({
    data: { courseId: aeCourse.id, order: 1, titleAr: "الوحدة الأولى", titleEn: "Unit 1", term: 1 },
  });
  const examLesson = await db.lesson.create({
    data: { unitId: examUnit.id, order: 1, kind: "VIDEO", titleAr: "درس", titleEn: "Lesson" },
  });
  const examItem = await db.questionItem.create({
    data: {
      courseId: aeCourse.id,
      lessonId: examLesson.id,
      createdById: teacherAe.id,
      kind: "MCQ",
      prompt: "2 + 2 = ?",
      marks: 1,
      choices: { create: [{ label: "4", correct: true, order: 1 }, { label: "5", correct: false, order: 2 }] },
    },
  });
  await db.examPaper.create({
    data: {
      courseId: aeCourse.id,
      createdById: teacherAe.id,
      title: "E2E exam",
      durationMin: 30,
      maxAttempts: 1,
      published: true,
      items: { create: [{ itemId: examItem.id, order: 0 }] },
    },
  });

  // Live lectures: the UAE teacher is approved, the Egypt teacher keeps the default (not approved).
  // The live session starts in two minutes, so the student's join window (start - 10 min) is open.
  await db.user.update({ where: { id: teacherAe.id }, data: { liveApproved: true } });
  const course = await db.course.findUniqueOrThrow({ where: { slug: "ae-12-math-e2e" } });
  await db.liveSession.deleteMany({ where: { courseId: course.id } });
  const start = new Date(Date.now() + 2 * 60_000);
  await db.liveSession.createMany({
    data: [
      {
        courseId: course.id,
        titleAr: "حصة مباشرة للتجربة",
        titleEn: "E2E live lecture",
        startsAt: start,
        durationMin: 60,
        roomUrl: "https://meet.google.com/e2e-live",
      },
      {
        courseId: course.id,
        titleAr: "حصة ملغاة للتجربة",
        titleEn: "E2E cancelled lecture",
        startsAt: start,
        durationMin: 60,
        roomUrl: "https://meet.google.com/e2e-cancelled",
        cancelledAt: new Date(),
      },
    ],
  });
  // A whole-course grant, which is what opens live for a non-MONTHLY, non-rental entitlement.
  await db.entitlement.deleteMany({ where: { userId: studentAe.id, courseId: course.id } });
  await db.entitlement.create({
    data: {
      userId: studentAe.id,
      courseId: course.id,
      accessType: "SEMESTER",
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 30 * 86_400_000),
    },
  });
  // The seeded Egypt teacher (01000000000) owns the Egypt courses; give it the same password.
  await db.user.update({ where: { phone: "01000000000" }, data: { passwordHash: hash } });
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
