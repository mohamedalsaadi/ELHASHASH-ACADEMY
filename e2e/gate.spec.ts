// Mandatory homework: the lessons after a lesson with required work stay closed until the student hands it in. A quiz on Google
// Forms is handed in with "I finished" (only after opening it through the site); the teacher can let one student through.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test, expect, signInAs } from "./fixtures";
import { freshStudent, sql } from "./db";
import { PERSONAS } from "./personas";

const words = (loc: string) => JSON.parse(readFileSync(`messages/${loc}.json`, "utf8"));

/** A throwaway published course with two lessons, a running plan for the given students, and a required Google quiz on lesson 1. */
async function gatedCourse(tag: string, studentIds: string[]) {
  const base = (await sql<{ gradeId: string; subjectId: string; instructorId: string }>(`SELECT "gradeId", "subjectId", "instructorId" FROM "Course" WHERE slug = 'ae-12-math-e2e'`))[0];
  const courseId = randomUUID(), unitId = randomUUID(), l1 = randomUUID(), l2 = randomUUID(), assignmentId = randomUUID();
  const slug = `gate-${tag}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  await sql(`INSERT INTO "Course" (id, slug, "gradeId", "subjectId", "instructorId", "titleAr", "titleEn", published) VALUES ($1,$2,$3,$4,$5,'مادة البوابة','Gate course', true)`, [courseId, slug, base.gradeId, base.subjectId, base.instructorId]);
  await sql(`INSERT INTO "Unit" (id, "courseId", "order", "titleAr", "titleEn", term) VALUES ($1,$2,1,'وحدة','Unit',1)`, [unitId, courseId]);
  await sql(`INSERT INTO "Lesson" (id, "unitId", "order", kind, "titleAr", "titleEn") VALUES ($1,$2,1,'VIDEO','الدرس الأول','First gate lesson'), ($3,$2,2,'VIDEO','الدرس الثاني','Second gate lesson')`, [l1, unitId, l2]);
  for (const id of studentIds) await sql(`INSERT INTO "Entitlement" (id, "userId", "courseId", "startsAt") VALUES ($1,$2,$3, (now() at time zone 'utc') - interval '1 minute')`, [randomUUID(), id, courseId]);
  await sql(
    `INSERT INTO "Assignment" (id, "courseId", "lessonId", "createdById", kind, title, "linkUrl", required, "updatedAt") VALUES ($1,$2,$3,$4,'QUIZ',$5,'https://docs.google.com/forms/d/e/e2e-gate/viewform?usp=pp_url&entry.5={student}', true, now())`,
    [assignmentId, courseId, l1, base.instructorId, `Gate quiz ${tag}`],
  );
  return { slug, courseId, l1, l2, assignmentId };
}

test("a required Google quiz keeps the next lesson closed until the student presses I finished", async ({ page, loc }) => {
  const w = words(loc);
  const student = (await sql<{ id: string }>(`SELECT id FROM "User" WHERE phone = $1`, [PERSONAS.studentAe.phone]))[0];
  const c = await gatedCourse(`close-${loc}-${test.info().project.name}`, [student.id]);
  try {
    await signInAs(page, loc, PERSONAS.studentAe.phone);

    // Lesson 2 is closed and says what to do; lesson 1 is open; the course page says it too.
    await page.goto(`/${loc}/courses/${c.slug}/lessons/${c.l2}`);
    await expect(page.getByText(w.gate.closedTitle)).toBeVisible();
    await expect(page.locator(`a[href$="/assignments/${c.assignmentId}"]`).first()).toBeVisible();
    await page.goto(`/${loc}/courses/${c.slug}/lessons/${c.l1}`);
    await expect(page.getByText(w.gate.closedTitle)).toHaveCount(0);
    await page.goto(`/${loc}/courses/${c.slug}`);
    await expect(page.getByText(w.gate.courseBannerTitle)).toBeVisible();

    // I finished is refused before the form was opened through the site.
    await page.goto(`/${loc}/courses/${c.slug}/assignments/${c.assignmentId}`);
    await expect(page.getByText(w.homework.requiredNote)).toBeVisible();
    await page.getByRole("button", { name: w.homework.finishedButton }).click();
    await expect(page.getByText(w.homework.openFirst)).toBeVisible();

    // Open it through the gate (what the Open the quiz button does), then press I finished.
    expect((await page.request.get(`/api/out/${c.assignmentId}`, { maxRedirects: 0 })).status()).toBe(302);
    await page.goto(`/${loc}/courses/${c.slug}/assignments/${c.assignmentId}`);
    await page.getByRole("button", { name: w.homework.finishedButton }).click();
    await expect.poll(async () => (await sql<{ status: string }>(`SELECT status::text FROM "Submission" WHERE "assignmentId" = $1 AND "studentId" = $2`, [c.assignmentId, student.id]))[0]?.status).toBe("SUBMITTED");

    await page.goto(`/${loc}/courses/${c.slug}/lessons/${c.l2}`);
    await expect(page.getByText(w.gate.closedTitle)).toHaveCount(0);
    await expect(page.locator("h1")).toContainText(loc === "ar" ? "الدرس الثاني" : "Second gate lesson");
  } finally {
    await sql(`DELETE FROM "Course" WHERE id = $1`, [c.courseId]);
  }
});

test("a teacher can let one student past required work, and sees who is behind", async ({ page, loc }) => {
  const tag = `${loc}-${test.info().project.name}`;
  const behind = await freshStudent(`behind-${tag}`);
  const c = await gatedCourse(`pass-${tag}`, [behind.id]);
  try {
    await signInAs(page, loc, PERSONAS.teacherAe.phone);
    await page.goto(`/${loc}/teacher/assignments/${c.assignmentId}`);
    const row = page.locator("li", { hasText: `E2E behind-${tag}` });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: words(loc).homework.letThrough }).click();
    await expect.poll(async () => (await sql<{ n: number }>(`SELECT count(*)::int AS n FROM "Submission" WHERE "assignmentId" = $1 AND "studentId" = $2`, [c.assignmentId, behind.id]))[0].n).toBe(1);

    // And that student now opens lesson 2.
    await signInAs(page, loc, behind.phone);
    await page.goto(`/${loc}/courses/${c.slug}/lessons/${c.l2}`);
    await expect(page.getByText(words(loc).gate.closedTitle)).toHaveCount(0);
  } finally {
    await sql(`DELETE FROM "Course" WHERE id = $1`, [c.courseId]);
  }
});

test("work that is not required never closes a lesson", async ({ page, loc }) => {
  const student = (await sql<{ id: string }>(`SELECT id FROM "User" WHERE phone = $1`, [PERSONAS.studentAe.phone]))[0];
  const c = await gatedCourse(`optional-${loc}-${test.info().project.name}`, [student.id]);
  try {
    await sql(`UPDATE "Assignment" SET required = false WHERE id = $1`, [c.assignmentId]);
    await signInAs(page, loc, PERSONAS.studentAe.phone);
    await page.goto(`/${loc}/courses/${c.slug}/lessons/${c.l2}`);
    await expect(page.getByText(words(loc).gate.closedTitle)).toHaveCount(0);
  } finally {
    await sql(`DELETE FROM "Course" WHERE id = $1`, [c.courseId]);
  }
});
