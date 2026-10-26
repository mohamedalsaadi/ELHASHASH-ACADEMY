// UAE repricing, 2026-10-26. Sets the UAE plan ladder and the tiered bundle rules.
// Dry run by default; pass --apply to write. Run: npx tsx prisma/seed-uae-prices.ts [--apply] [--activate-monthly]
// Needs the bundle_min_subjects migration first: the dry run only works after it.
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");
const ACTIVATE_MONTHLY = process.argv.includes("--activate-monthly");
const SLUG = "ae-12-adv-math";

/** Minor units, AED. 10-15% under Hamad Academy's 550/month per subject:
    32-lecture year: single 65, monthly (8) 495, semester (16) 990, year (32) 1870. */
const PRICES = { SEMESTER: 99000, YEARLY: 187000, MONTHLY: 49500, RENTAL: 6500 } as const;
const BUNDLE_SUBJECTS = ["math", "physics", "chemistry"];

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const aed = (minor: number) => `${(minor / 100).toFixed(2)} AED`;

type Sku = { id: string; accessType: string; price: number; currency: string; active: boolean; month: number | null };

async function main() {
  const course = await db.course.findUnique({
    where: { slug: SLUG },
    select: {
      id: true,
      titleEn: true,
      grade: { select: { country: { select: { code: true } } } },
      units: { select: { isFree: true, lessons: { select: { id: true } } } },
    },
  });
  if (!course) throw new Error(`course ${SLUG} not found`);
  if (course.grade?.country.code !== "AE") throw new Error(`${SLUG} is not a UAE course`);

  const paidLessons = course.units.filter((u) => !u.isFree).flatMap((u) => u.lessons.map((l) => l.id));
  const before = (await db.sku.findMany({
    where: { courseId: course.id, lessonId: null, liveSessionId: null },
    select: { id: true, accessType: true, price: true, currency: true, active: true, month: true },
    orderBy: { accessType: "asc" },
  })) as Sku[];

  console.log(`\n${course.titleEn} (${SLUG}) — ${paidLessons.length} paid lessons`);
  console.log(`mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`);
  console.log("before:");
  console.table(before.map((s) => ({ plan: s.accessType, price: aed(s.price), currency: s.currency, active: s.active })));

  const bundles = await readBundles();

  const monthlySellable = (await db.lesson.count({ where: { month: 1, unit: { courseId: course.id, isFree: false } } })) > 0;
  const monthlyActive = ACTIVATE_MONTHLY && monthlySellable;

  if (!APPLY) {
    console.log("\nplan:");
    console.table([
      { plan: "SEMESTER", price: aed(PRICES.SEMESTER), note: "update" },
      { plan: "YEARLY", price: aed(PRICES.YEARLY), note: "update (flat course price)" },
      {
        plan: "MONTHLY",
        price: aed(PRICES.MONTHLY),
        note: monthlyActive ? "active" : "inactive: no paid lesson has month 1",
      },
      { plan: "RENTAL", price: aed(PRICES.RENTAL), note: `${paidLessons.length} paid lessons would get one` },
    ]);
    console.log("\nbundles:");
    console.table([
      { name: "Bundle: 2 or more subjects", percentOff: 15, minSubjects: 2, subjects: BUNDLE_SUBJECTS.join(", ") },
      { name: "Bundle: 3 or more subjects", percentOff: 20, minSubjects: 3, subjects: BUNDLE_SUBJECTS.join(", ") },
    ]);
    if (bundles === null) console.log("\nNote: BundleRule.minSubjects is missing — the bundle writes need `prisma migrate deploy` first.");
    console.log("\nDry run: nothing written. Re-run with --apply.\n");
    return;
  }

  if (bundles === null) throw new Error("BundleRule.minSubjects is missing — run `prisma migrate deploy` before --apply");

  const subjectIds = await db.subject.findMany({ where: { slug: { in: BUNDLE_SUBJECTS } }, select: { id: true, slug: true } });
  if (subjectIds.length !== BUNDLE_SUBJECTS.length) throw new Error(`missing subjects: have ${subjectIds.map((s) => s.slug).join(", ")}`);

  await db.$transaction(async (tx) => {
    await tx.sku.updateMany({ where: { courseId: course.id, accessType: "SEMESTER" }, data: { price: PRICES.SEMESTER, currency: "AED" } });
    await tx.sku.updateMany({ where: { courseId: course.id, accessType: "YEARLY" }, data: { price: PRICES.YEARLY, currency: "AED" } });

    const monthly = await tx.sku.findFirst({ where: { courseId: course.id, accessType: "MONTHLY", month: 1 } });
    if (monthly) {
      await tx.sku.update({ where: { id: monthly.id }, data: { price: PRICES.MONTHLY, active: monthlyActive } });
    } else {
      await tx.sku.create({
        data: {
          courseId: course.id,
          accessType: "MONTHLY",
          price: PRICES.MONTHLY,
          currency: "AED",
          month: 1,
          accessDays: 30,
          active: monthlyActive,
        },
      });
    }

    // One rental per paid lesson; today there are none, because every UAE lesson sits in the free unit.
    for (const lessonId of paidLessons) {
      const existing = await tx.sku.findFirst({ where: { courseId: course.id, accessType: "RENTAL", lessonId } });
      if (existing) {
        await tx.sku.update({ where: { id: existing.id }, data: { price: PRICES.RENTAL, active: true } });
      } else {
        await tx.sku.create({
          data: { courseId: course.id, accessType: "RENTAL", lessonId, price: PRICES.RENTAL, currency: "AED", accessDays: 7, active: true },
        });
      }
    }

    const tierTwo = await tx.bundleRule.findFirst({ where: { name: { in: ["Math + Physics", "Bundle: 2 or more subjects"] } } });
    const two = { name: "Bundle: 2 or more subjects", percentOff: 15, minSubjects: 2, active: true };
    if (tierTwo) await tx.bundleRule.update({ where: { id: tierTwo.id }, data: { ...two, subjects: { set: subjectIds.map((s) => ({ id: s.id })) } } });
    else await tx.bundleRule.create({ data: { ...two, subjects: { connect: subjectIds.map((s) => ({ id: s.id })) } } });

    const tierThree = await tx.bundleRule.findFirst({ where: { name: "Bundle: 3 or more subjects" } });
    const three = { name: "Bundle: 3 or more subjects", percentOff: 20, minSubjects: 3, active: true };
    if (tierThree) await tx.bundleRule.update({ where: { id: tierThree.id }, data: { ...three, subjects: { set: subjectIds.map((s) => ({ id: s.id })) } } });
    else await tx.bundleRule.create({ data: { ...three, subjects: { connect: subjectIds.map((s) => ({ id: s.id })) } } });
  });

  const after = (await db.sku.findMany({
    where: { courseId: course.id, lessonId: null, liveSessionId: null },
    select: { id: true, accessType: true, price: true, currency: true, active: true, month: true },
    orderBy: { accessType: "asc" },
  })) as Sku[];

  console.log("\nafter:");
  console.table(after.map((s) => ({ plan: s.accessType, price: aed(s.price), currency: s.currency, active: s.active })));

  const changed = after.some((s) => {
    const old = before.find((b) => b.id === s.id);
    return !old || old.price !== s.price || old.active !== s.active;
  });
  console.log(changed ? "\nApplied.\n" : "\nUnchanged — nothing to do.\n");
}

/** Reads the rules, or reports that the migration has not run yet. */
async function readBundles() {
  try {
    return await db.bundleRule.findMany({ select: { id: true, name: true, percentOff: true, minSubjects: true, active: true } });
  } catch {
    return null;
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
