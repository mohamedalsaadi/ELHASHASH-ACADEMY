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
    where: { countryId_curriculum_level: { countryId: ae.id, curriculum: "MOE", level: 12 } },
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
  await user(PERSONAS.studentAe, ae12.id);
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
