// A finished video upload must end up on its lesson without a second step. Sayed lost two uploads on 2026-11-23:
// one because Save was never pressed, one because adding another lesson mid-upload re-rendered every lesson form.
// VdoCipher is faked with page.route; the upload link sits on amazonaws.com, which the CSP allows, like the real one.
import { randomUUID } from "node:crypto";
import { test, expect, signInAs } from "./fixtures";
import { courseIdOf, sql } from "./db";
import { PERSONAS } from "./personas";

async function courseWithTwoLessons() {
  const [base] = await sql<{ gradeId: string; subjectId: string; instructorId: string }>(`SELECT "gradeId", "subjectId", "instructorId" FROM "Course" WHERE id = $1`, [await courseIdOf("ae-12-math-e2e")]);
  const course = randomUUID(), unit = randomUUID(), a = randomUUID(), b = randomUUID();
  await sql(`INSERT INTO "Course" (id, slug, "gradeId", "subjectId", "instructorId", "titleAr", "titleEn") VALUES ($1, $2, $3, $4, $5, 'دورة رفع', 'Upload course')`, [course, `e2e-upload-${course.slice(0, 8)}`, base.gradeId, base.subjectId, base.instructorId]);
  await sql(`INSERT INTO "Unit" (id, "courseId", "order", "titleAr", "titleEn") VALUES ($1, $2, 1, 'وحدة', 'Unit')`, [unit, course]);
  await sql(`INSERT INTO "Lesson" (id, "unitId", "order", kind, "titleAr", "titleEn") VALUES ($1, $3, 1, 'VIDEO', 'درس أ', 'Lesson A'), ($2, $3, 2, 'VIDEO', 'درس ب', 'Lesson B')`, [a, b, unit]);
  return { course, a, b };
}

const videoOf = async (lessonId: string) =>
  (await sql<{ externalId: string | null }>(`SELECT v."externalId" FROM "Lesson" l LEFT JOIN "VideoAsset" v ON v.id = l."videoId" WHERE l.id = $1`, [lessonId]))[0]?.externalId ?? null;

test("an upload saves its lesson by itself, even when another lesson is saved while it runs", async ({ page, loc }) => {
  const { course, a, b } = await courseWithTwoLessons();
  const videoId = `vdo-e2e-${randomUUID().slice(0, 8)}`;
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/api/vdocipher/upload", (r) => r.fulfill({ json: { videoId, uploadLink: "https://e2e-vdo.s3.amazonaws.com/", fields: { key: videoId } } }));
  await page.route("https://e2e-vdo.s3.amazonaws.com/**", async (r) => {
    await gate;
    await r.fulfill({ status: 201, body: "" });
  });

  await signInAs(page, loc, PERSONAS.teacherAe.phone);
  await page.goto(`/${loc}/admin/courses/${course}`);
  const formA = page.locator(`form:has(input[name="id"][value="${a}"])`);
  const formB = page.locator(`form:has(input[name="id"][value="${b}"])`);
  const sent = page.waitForRequest("https://e2e-vdo.s3.amazonaws.com/**");
  await formA.locator('input[type="file"][accept^="video"]').setInputFiles({ name: "a.mp4", mimeType: "video/mp4", buffer: Buffer.from("not really a video") });
  await sent;

  // While A uploads, save B: the page re-renders and A's form is replaced.
  await formB.locator('input[name="titleEn"]').fill("Lesson B saved");
  await formB.locator('input[name="titleEn"]').press("Enter");
  await expect.poll(async () => (await sql<{ titleEn: string }>(`SELECT "titleEn" FROM "Lesson" WHERE id = $1`, [b]))[0].titleEn).toBe("Lesson B saved");

  release();
  await expect.poll(() => videoOf(a), { timeout: 15_000 }).toBe(videoId);
  expect(await videoOf(b)).toBeNull();
});
