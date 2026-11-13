// Notices to every student of a grade (live session scheduled, new course, August promotion), the same-day live reminder,
// course ratings with the admin's queue for low ones, and the locked/owned look of the student home.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test, expect, signInAs } from "./fixtures";
import { courseIdOf, freshStudent, sql } from "./db";
import { PERSONAS } from "./personas";

const words = (loc: string) => JSON.parse(readFileSync(`messages/${loc}.json`, "utf8"));
const COURSE = "ae-12-math-e2e";
const idOf = async (phone: string) => (await sql<{ id: string }>(`SELECT id FROM "User" WHERE phone = $1`, [phone]))[0].id;
const noticeKeys = (like: string) => sql<{ userId: string }>(`SELECT "userId" FROM "Notification" WHERE "dedupeKey" LIKE $1`, [like]);

/** A throwaway published course in UAE grade 12 with two lessons, taught by the base course's teacher. */
async function course(tag: string, published = true) {
  const base = (await sql<{ gradeId: string; subjectId: string; instructorId: string }>(`SELECT "gradeId", "subjectId", "instructorId" FROM "Course" WHERE slug = $1`, [COURSE]))[0];
  const courseId = randomUUID(), unitId = randomUUID(), l1 = randomUUID(), l2 = randomUUID();
  const slug = `ar-${tag}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  await sql(`INSERT INTO "Course" (id, slug, "gradeId", "subjectId", "instructorId", "titleAr", "titleEn", published) VALUES ($1,$2,$3,$4,$5,'مادة التقييم','Review course', $6)`, [courseId, slug, base.gradeId, base.subjectId, base.instructorId, published]);
  await sql(`INSERT INTO "Unit" (id, "courseId", "order", "titleAr", "titleEn", term) VALUES ($1,$2,1,'وحدة','Unit',1)`, [unitId, courseId]);
  await sql(`INSERT INTO "Lesson" (id, "unitId", "order", kind, "titleAr", "titleEn") VALUES ($1,$2,1,'VIDEO','الأول','One'), ($3,$2,2,'VIDEO','الثاني','Two')`, [l1, unitId, l2]);
  return { slug, courseId, lessons: [l1, l2], instructorId: base.instructorId };
}
const subscribe = (userId: string, courseId: string) =>
  sql(`INSERT INTO "Entitlement" (id, "userId", "courseId", "startsAt") VALUES ($1,$2,$3,(now() at time zone 'utc') - interval '1 minute')`, [randomUUID(), userId, courseId]);
const finish = (userId: string, lessons: string[]) =>
  Promise.all(lessons.map((l) => sql(`INSERT INTO "LessonView" ("userId","lessonId","completedAt","lastSeenAt") VALUES ($1,$2,(now() at time zone 'utc'),(now() at time zone 'utc'))`, [userId, l])));

test("a live session scheduled in the course editor tells every student of the grade, and nobody else", async ({ page, loc }) => {
  const tag = `${loc}-${test.info().project.name}`;
  const title = `Alert live ${tag}`;
  const courseId = await courseIdOf(COURSE);
  let sessionId = "";
  try {
    await signInAs(page, loc, PERSONAS.teacherAe.phone);
    await page.goto(`/${loc}/admin/courses/${courseId}`);
    const form = page.locator('form:has(input[name="back"])');
    await form.locator('input[name="titleAr"]').fill(`حصة ${tag}`);
    await form.locator('input[name="titleEn"]').fill(title);
    await form.locator('input[name="startsAt"]').fill(`${new Date().getFullYear() + 1}-03-10T10:00`);
    await form.getByRole("button").last().click();
    await expect.poll(async () => (sessionId = (await sql<{ id: string }>(`SELECT id FROM "LiveSession" WHERE "titleEn" = $1`, [title]))[0]?.id ?? "")).not.toBe("");

    const grade = await idOf(PERSONAS.studentAe2.phone);
    await expect.poll(async () => (await noticeKeys(`live-new:${sessionId}:%`)).map((r) => r.userId)).toContain(grade);
    const told = (await noticeKeys(`live-new:${sessionId}:%`)).map((r) => r.userId);
    expect(told).toContain(await idOf(PERSONAS.studentAe.phone));
    expect(told).not.toContain(await idOf(PERSONAS.studentEg.phone));
  } finally {
    if (sessionId) {
      await sql(`DELETE FROM "Notification" WHERE "dedupeKey" LIKE $1`, [`live-new:${sessionId}:%`]);
      await sql(`DELETE FROM "LiveSession" WHERE id = $1`, [sessionId]);
    }
  }
});

test("the morning job reminds subscribers of a live session today once, and non-subscribers not at all", async ({ request }) => {
  const courseId = await courseIdOf(COURSE);
  const id = randomUUID();
  const sub = await idOf(PERSONAS.studentAe.phone);
  const stranger = await idOf(PERSONAS.studentAe2.phone);
  await sql(`INSERT INTO "LiveSession" (id, "courseId", "titleAr", "titleEn", "startsAt", "durationMin") VALUES ($1,$2,'حصة اليوم','Today live',(now() at time zone 'utc') + interval '3 hours', 60)`, [id, courseId]);
  try {
    expect((await request.get("/api/cron/live-day")).status()).toBe(401);
    const auth = { headers: { authorization: "Bearer e2e-cron" } };
    const first = await request.get("/api/cron/live-day", auth);
    expect(first.status()).toBe(200);
    const users = (await noticeKeys(`live-day:${id}:%`)).map((r) => r.userId);
    expect(users).toContain(sub);
    expect(users).not.toContain(stranger);
    const again = await (await request.get("/api/cron/live-day", auth)).json();
    expect((await noticeKeys(`live-day:${id}:%`)).length).toBe(users.length);
    expect(again.sent).toBe(0);
  } finally {
    await sql(`DELETE FROM "Notification" WHERE "dedupeKey" LIKE $1`, [`live-day:${id}:%`]);
    await sql(`DELETE FROM "LiveSession" WHERE id = $1`, [id]);
  }
});

test("publishing a course tells every student of its grade", async ({ page, loc }) => {
  const c = await course(`new-${loc}-${test.info().project.name}`, false);
  try {
    await signInAs(page, loc, PERSONAS.admin.phone);
    await page.goto(`/${loc}/admin/courses/${c.courseId}`);
    const form = page.locator('form:has(input[name="published"])');
    await form.locator('input[name="published"]').check();
    await form.getByRole("button").last().click();
    await expect.poll(async () => (await noticeKeys(`newcourse:${c.courseId}:%`)).length).toBeGreaterThan(1);
    const told = (await noticeKeys(`newcourse:${c.courseId}:%`)).map((r) => r.userId);
    expect(told).toContain(await idOf(PERSONAS.studentAe2.phone));
    expect(told).not.toContain(await idOf(PERSONAS.studentEg.phone));
  } finally {
    await sql(`DELETE FROM "Notification" WHERE "dedupeKey" LIKE $1`, [`newcourse:${c.courseId}:%`]);
    await sql(`DELETE FROM "Course" WHERE id = $1`, [c.courseId]);
  }
});

test("the August job moves a student up one grade once, and leaves a terminal year alone", async ({ request }) => {
  const ae = (await sql<{ id: string }>(`SELECT id FROM "Country" WHERE code = 'AE'`))[0].id;
  const g12 = (await sql<{ id: string }>(`SELECT id FROM "Grade" WHERE "countryId" = $1 AND level = 12 AND track = 'GENERAL'`, [ae]))[0].id;
  const g11 = randomUUID();
  await sql(`INSERT INTO "Grade" (id, "countryId", curriculum, level, track, "nameAr", "nameEn", "isTerminal", active, "order") VALUES ($1,$2,'MOE',11,'GENERAL','الحادي عشر','Grade 11',false,true,0)`, [g11, ae]);
  const up = await freshStudent("promote-up");
  const top = await freshStudent("promote-top");
  await sql(`UPDATE "User" SET "gradeId" = $2 WHERE id = $1`, [up.id, g11]);
  await sql(`UPDATE "User" SET "gradeId" = $2 WHERE id = $1`, [top.id, g12]);
  const gradeOf = async (id: string) => (await sql<{ gradeId: string }>(`SELECT "gradeId" FROM "User" WHERE id = $1`, [id]))[0].gradeId;
  const auth = { headers: { authorization: "Bearer e2e-cron" } };
  try {
    expect((await request.get("/api/cron/promote")).status()).toBe(401);
    const dry = await (await request.get("/api/cron/promote?dry=1", auth)).json();
    expect(dry.moves.some((m: { from: string; to: string }) => m.from === "Grade 11" && m.to === "Grade 12")).toBe(true);
    expect(await gradeOf(up.id)).toBe(g11);

    expect((await request.get("/api/cron/promote", auth)).status()).toBe(200);
    expect(await gradeOf(up.id)).toBe(g12);
    expect(await gradeOf(top.id)).toBe(g12);
    expect((await noticeKeys(`promote:%:${up.id}`)).length).toBe(1);

    await request.get("/api/cron/promote", auth);
    expect(await gradeOf(up.id)).toBe(g12);
    expect((await noticeKeys(`promote:%:${up.id}`)).length).toBe(1);
  } finally {
    await sql(`DELETE FROM "Notification" WHERE "userId" IN ($1,$2)`, [up.id, top.id]);
    await sql(`DELETE FROM "User" WHERE id IN ($1,$2)`, [up.id, top.id]);
    await sql(`DELETE FROM "Grade" WHERE id = $1`, [g11]);
  }
});

test("only a student who really took the course can rate it; a low rating waits for the admin, who can publish or remove it", async ({ page, loc }) => {
  const w = words(loc).reviews;
  const tag = `${loc}-${test.info().project.name}`;
  const c = await course(`rate-${tag}`);
  const lazy = await freshStudent(`lazy-${tag}`);
  const keen = await freshStudent(`keen-${tag}`);
  const other = await freshStudent(`other-${tag}`);
  try {
    for (const s of [lazy, keen, other]) await subscribe(s.id, c.courseId);
    await finish(keen.id, c.lessons);
    await finish(other.id, c.lessons);

    // Nothing finished: no rating box.
    await signInAs(page, loc, lazy.phone);
    await page.goto(`/${loc}/courses/${c.slug}`);
    await expect(page.locator("#rate")).toHaveCount(0);

    // Finished: a 1 out of 5 is held, and says so.
    await signInAs(page, loc, keen.phone);
    await page.goto(`/${loc}/courses/${c.slug}`);
    await page.locator('#rate label:has(input[value="1"])').click();
    await page.locator('#rate textarea[name="text"]').fill("Too fast for me");
    await page.locator("#rate").getByRole("button", { name: w.send }).click();
    await expect(page.getByText(w.held)).toBeVisible();
    expect((await sql<{ status: string }>(`SELECT status::text FROM "CourseReview" WHERE "courseId" = $1 AND "studentId" = $2`, [c.courseId, keen.id]))[0].status).toBe("HELD");

    // A 5 out of 5 is published at once.
    await signInAs(page, loc, other.phone);
    await page.goto(`/${loc}/courses/${c.slug}`);
    await page.locator('#rate label:has(input[value="5"])').click();
    await page.locator("#rate").getByRole("button", { name: w.send }).click();
    await expect.poll(async () => (await sql<{ status: string }>(`SELECT status::text FROM "CourseReview" WHERE "courseId" = $1 AND "studentId" = $2`, [c.courseId, other.id]))[0]?.status).toBe("PUBLISHED");

    // The admin sees the held one, cannot remove it without a reason, and can publish it.
    await signInAs(page, loc, PERSONAS.admin.phone);
    await page.goto(`/${loc}/admin/reviews`);
    const card = page.locator("section", { hasText: "Too fast for me" });
    await expect(card).toBeVisible();
    await card.locator('input[name="reason"]').fill("Not a fair review");
    await card.getByRole("button", { name: w.remove }).click();
    await expect.poll(async () => (await sql<{ status: string; adminNote: string }>(`SELECT status::text, "adminNote" FROM "CourseReview" WHERE "courseId" = $1 AND "studentId" = $2`, [c.courseId, keen.id]))[0]).toMatchObject({ status: "REMOVED", adminNote: "Not a fair review" });
  } finally {
    await sql(`DELETE FROM "Notification" WHERE href = '/admin/reviews'`);
    await sql(`DELETE FROM "Course" WHERE id = $1`, [c.courseId]);
    await sql(`DELETE FROM "User" WHERE id IN ($1,$2,$3)`, [lazy.id, keen.id, other.id]);
  }
});

test("a rating shows on the course card and the teacher page only from three published reviews", async ({ page, loc }) => {
  const tag = `${loc}-${test.info().project.name}`;
  const c = await course(`show-${tag}`);
  const students = [await freshStudent(`show1-${tag}`), await freshStudent(`show2-${tag}`), await freshStudent(`show3-${tag}`)];
  const line = (avg: number, count: number) => words(loc).reviews.ratingLine.replace("{avg}", String(avg)).replace("{count}", String(count));
  const add = (s: { id: string }, stars: number) =>
    sql(`INSERT INTO "CourseReview" (id, "courseId", "studentId", stars, text, status, "updatedAt") VALUES ($1,$2,$3,$4,$5,'PUBLISHED', now())`, [randomUUID(), c.courseId, s.id, stars, `Good ${stars}`]);
  try {
    await add(students[0], 5);
    await add(students[1], 4);
    await page.goto(`/${loc}/teachers/${c.instructorId}`);
    await expect(page.getByText(line(4.5, 2))).toHaveCount(0);

    await add(students[2], 3);
    await page.goto(`/${loc}/teachers/${c.instructorId}`);
    await expect(page.getByText(line(4, 3)).first()).toBeVisible();
    await expect(page.getByText("Good 5")).toBeVisible();
  } finally {
    await sql(`DELETE FROM "Course" WHERE id = $1`, [c.courseId]);
    await sql(`DELETE FROM "User" WHERE id = ANY($1::text[])`, [students.map((s) => s.id)]);
  }
});

test("the student home marks a course the student has as subscribed and one they have not as locked", async ({ page, loc }) => {
  const w = words(loc).catalog;
  await signInAs(page, loc, PERSONAS.studentAe.phone);
  await page.goto(`/${loc}/me`);
  await expect(page.getByText(w.ownedChip).first()).toBeVisible();

  const none = await freshStudent(`home-${loc}-${test.info().project.name}`);
  await sql(`UPDATE "User" SET "gradeId" = (SELECT "gradeId" FROM "Course" WHERE slug = $2) WHERE id = $1`, [none.id, COURSE]);
  try {
    await signInAs(page, loc, none.phone);
    await page.goto(`/${loc}/me`);
    await expect(page.getByText(w.lockedChip).first()).toBeVisible();
    // The new-courses strip must never make the page wider than the screen (it once did, on a phone).
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await sql(`DELETE FROM "User" WHERE id = $1`, [none.id]);
  }
});
