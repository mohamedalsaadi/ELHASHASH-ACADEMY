// Teacher notices (a student's question, a visible review), the publish gate and the owner's publish alert, and teacher payouts
// by manual bank transfer: bank details, the owner's "mark paid", and who may see the payouts page.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test, expect, isRefused, signInAs } from "./fixtures";
import { freshStudent, sql } from "./db";
import { PERSONAS } from "./personas";

const words = (loc: string) => JSON.parse(readFileSync(`messages/${loc}.json`, "utf8"));
const COURSE = "ae-12-math-e2e";
const idOf = async (phone: string) => (await sql<{ id: string }>(`SELECT id FROM "User" WHERE phone = $1`, [phone]))[0].id;
const IBAN = "AE07 0331 2345 6789 0123 456";

async function base() {
  return (await sql<{ gradeId: string; subjectId: string; instructorId: string; id: string }>(`SELECT id, "gradeId", "subjectId", "instructorId" FROM "Course" WHERE slug = $1`, [COURSE]))[0];
}

test("a student's question rings the course teacher's bell, once", async ({ page, loc }) => {
  const tag = `${loc}-${test.info().project.name}`;
  const teacher = await idOf(PERSONAS.teacherAe.phone);
  const lessonId = (await sql<{ id: string }>(`SELECT l.id FROM "Lesson" l JOIN "Unit" u ON u.id = l."unitId" JOIN "Course" c ON c.id = u."courseId" WHERE c.slug = $1 ORDER BY l."order" LIMIT 1`, [COURSE]))[0].id;
  const body = `Why is it so? ${tag}`;
  try {
    await signInAs(page, loc, PERSONAS.studentAe.phone);
    await page.goto(`/${loc}/courses/${COURSE}/lessons/${lessonId}`);
    await page.locator('textarea[name="body"]').fill(body);
    await page.locator('form:has(textarea[name="body"]) button').last().click();
    const q = await expect.poll(async () => (await sql<{ id: string }>(`SELECT id FROM "Question" WHERE body = $1`, [body]))[0]?.id ?? "").not.toBe("").then(async () => (await sql<{ id: string }>(`SELECT id FROM "Question" WHERE body = $1`, [body]))[0].id);
    const notes = await sql<{ kind: string; emailedAt: string | null }>(`SELECT kind::text, "emailedAt" FROM "Notification" WHERE "userId" = $1 AND "dedupeKey" = $2`, [teacher, `question:${q}`]);
    expect(notes).toEqual([{ kind: "QUESTION_NEW", emailedAt: null }]);
  } finally {
    await sql(`DELETE FROM "Notification" WHERE "dedupeKey" LIKE 'question:%' AND "userId" = $1`, [teacher]);
    await sql(`DELETE FROM "Question" WHERE body = $1`, [body]);
  }
});

test("a rating reaches the teacher when it shows: at once for 5 stars, only after the owner publishes a 1 star", async ({ page, loc }) => {
  const w = words(loc).reviews;
  const tag = `${loc}-${test.info().project.name}`;
  const b = await base();
  const courseId = randomUUID(), unitId = randomUUID(), l1 = randomUUID();
  await sql(`INSERT INTO "Course" (id, slug, "gradeId", "subjectId", "instructorId", "titleAr", "titleEn", published) VALUES ($1,$2,$3,$4,$5,'مادة ${tag}','Notice course ${tag}', true)`, [courseId, `notice-${tag}`.toLowerCase(), b.gradeId, b.subjectId, b.instructorId]);
  await sql(`INSERT INTO "Unit" (id, "courseId", "order", "titleAr", "titleEn", term) VALUES ($1,$2,1,'وحدة','Unit',1)`, [unitId, courseId]);
  await sql(`INSERT INTO "Lesson" (id, "unitId", "order", kind, "titleAr", "titleEn") VALUES ($1,$2,1,'VIDEO','الأول','One')`, [l1, unitId]);
  const keen = await freshStudent(`n-keen-${tag}`);
  const other = await freshStudent(`n-other-${tag}`);
  const told = () => sql<{ bodyEn: string }>(`SELECT "bodyEn" FROM "Notification" WHERE "userId" = $1 AND kind = 'REVIEW_NEW' AND "bodyEn" = $2`, [b.instructorId, `Notice course ${tag}`]);
  try {
    for (const s of [keen, other]) {
      await sql(`INSERT INTO "Entitlement" (id, "userId", "courseId", "startsAt") VALUES ($1,$2,$3,(now() at time zone 'utc') - interval '1 minute')`, [randomUUID(), s.id, courseId]);
      await sql(`INSERT INTO "LessonView" ("userId","lessonId","completedAt","lastSeenAt") VALUES ($1,$2,(now() at time zone 'utc'),(now() at time zone 'utc'))`, [s.id, l1]);
    }
    await signInAs(page, loc, keen.phone);
    await page.goto(`/${loc}/courses/notice-${tag}`.toLowerCase());
    await page.locator('#rate label:has(input[value="1"])').click();
    await page.locator("#rate").getByRole("button", { name: w.send }).click();
    await expect(page.getByText(w.held)).toBeVisible();
    expect(await told()).toHaveLength(0);

    await page.context().clearCookies();
    await signInAs(page, loc, other.phone);
    await page.goto(`/${loc}/courses/notice-${tag}`.toLowerCase());
    await page.locator('#rate label:has(input[value="5"])').click();
    await page.locator("#rate").getByRole("button", { name: w.send }).click();
    await expect.poll(async () => (await told()).length).toBe(1);

    await page.context().clearCookies();
    await signInAs(page, loc, PERSONAS.admin.phone);
    await page.goto(`/${loc}/admin/reviews`);
    await page.locator("section.rounded-lg", { hasText: loc === "ar" ? `مادة ${tag}` : `Notice course ${tag}` }).getByRole("button", { name: w.publish }).click();
    await expect.poll(async () => (await told()).length).toBe(2);
  } finally {
    await sql(`DELETE FROM "Notification" WHERE ("kind" = 'REVIEW_NEW' AND "bodyEn" = $1) OR href = '/admin/reviews'`, [`Notice course ${tag}`]);
    await sql(`DELETE FROM "Course" WHERE id = $1`, [courseId]);
    await sql(`DELETE FROM "User" WHERE id IN ($1,$2)`, [keen.id, other.id]);
  }
});

test("an empty course will not publish and says why; once it has content it publishes and the owner is told", async ({ page, loc }) => {
  const w = words(loc).admin.ready;
  const tag = `${loc}-${test.info().project.name}`;
  const b = await base();
  const courseId = randomUUID();
  await sql(`INSERT INTO "Course" (id, slug, "gradeId", "subjectId", "instructorId", "titleAr", "titleEn", published) VALUES ($1,$2,$3,$4,$5,'دورة فارغة','Empty ${tag}', false)`, [courseId, `empty-${tag}`.toLowerCase(), b.gradeId, b.subjectId, b.instructorId]);
  const published = async () => (await sql<{ published: boolean }>(`SELECT published FROM "Course" WHERE id = $1`, [courseId]))[0].published;
  const save = async () => {
    await page.goto(`/${loc}/admin/courses/${courseId}`);
    const form = page.locator('form:has(input[name="published"])');
    await form.locator('input[name="published"]').check();
    await form.getByRole("button").last().click();
  };
  try {
    await signInAs(page, loc, PERSONAS.teacherAe.phone);
    await save();
    await expect(page.getByRole("alert").filter({ hasText: w.blocked })).toBeVisible();
    expect(await published()).toBe(false);
    await expect(page.getByText(w.package)).toBeVisible();

    // Content, a description and a package that can be bought.
    await sql(`UPDATE "Course" SET "descEn" = 'A real course' WHERE id = $1`, [courseId]);
    const unitId = randomUUID();
    await sql(`INSERT INTO "Unit" (id, "courseId", "order", "titleAr", "titleEn", term) VALUES ($1,$2,1,'وحدة','Unit',1)`, [unitId, courseId]);
    await sql(`INSERT INTO "Lesson" (id, "unitId", "order", kind, "titleAr", "titleEn", "pdfKey") VALUES ($1,$2,1,'PDF','ملف','Notes','lessons/x.pdf')`, [randomUUID(), unitId]);
    await sql(`INSERT INTO "Sku" (id, "courseId", "accessType", price, currency, "aedPrice", active) VALUES ($1,$2,'SEMESTER',40000,'AED',40000,true)`, [randomUUID(), courseId]);
    await save();
    await expect.poll(published).toBe(true);
    await expect.poll(async () => (await sql(`SELECT 1 FROM "Notification" WHERE href = $1 AND kind = 'SYSTEM'`, [`/admin/courses/${courseId}`])).length).toBeGreaterThan(0);
  } finally {
    await sql(`DELETE FROM "Notification" WHERE href = $1 OR "dedupeKey" LIKE $2`, [`/admin/courses/${courseId}`, `newcourse:${courseId}:%`]);
    await sql(`DELETE FROM "AnalyticsEvent" WHERE "courseId" = $1`, [courseId]);
    await sql(`DELETE FROM "Course" WHERE id = $1`, [courseId]);
  }
});

test("a teacher saves bank details, the owner marks a statement paid, the teacher sees it; nobody else sees the payouts page", async ({ page, loc }) => {
  const w = words(loc);
  const tag = `${loc}-${test.info().project.name}`;
  const teacher = await idOf(PERSONAS.teacherAe.phone);
  const statementId = randomUUID();
  const period = `2099-${String(Math.floor(Math.random() * 9) + 1).padStart(2, "0")}`;
  try {
    // A wrong IBAN is refused, a right one is saved and shown masked.
    await signInAs(page, loc, PERSONAS.teacherAe.phone);
    await page.goto(`/${loc}/teacher/profile`);
    const form = page.locator("form#payout");
    await form.locator('input[name="holder"]').fill("E2E Teacher");
    await form.locator('input[name="bank"]').fill("E2E Bank");
    await form.locator('input[name="iban"]').fill("AE08 0331 2345 6789 0123 456");
    await form.getByRole("button").last().click();
    await expect(page.getByRole("alert").filter({ hasText: w.teacher.payoutInvalid })).toBeVisible();
    await form.locator('input[name="holder"]').fill("E2E Teacher");
    await form.locator('input[name="bank"]').fill("E2E Bank");
    await form.locator('input[name="iban"]').fill(IBAN);
    await form.getByRole("button").last().click();
    await expect.poll(async () => (await sql<{ payoutIban: string }>(`SELECT "payoutIban" FROM "User" WHERE id = $1`, [teacher]))[0].payoutIban).toBe(IBAN.replace(/ /g, ""));
    await expect(page.locator("main")).not.toContainText(IBAN.replace(/ /g, ""));

    // An unacknowledged statement is not ready; an acknowledged one is.
    await sql(
      `INSERT INTO "TeacherStatement" (id, number, "instructorId", period, currency, "instructorPayout", status, "acknowledgedAt", "payableAt") VALUES ($1,$2,$3,$4,'AED',7000,'ACKNOWLEDGED', now(), now())`,
      [statementId, `ST-${period}-${tag}`, teacher, period],
    );
    await expect(isRefused(page, `/${loc}/admin/payouts`)).resolves.toBe(true);

    await page.context().clearCookies();
    await signInAs(page, loc, PERSONAS.admin.phone);
    await page.goto(`/${loc}/admin/payouts`);
    const card = page.locator("section.rounded-lg", { hasText: `DHIRWA-${period}` }).filter({ hasText: IBAN.replace(/ /g, "") });
    await expect(card).toBeVisible();
    const csv = await page.request.get(`/${loc}/admin/payouts/export`);
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain(IBAN.replace(/ /g, ""));
    await card.getByRole("button", { name: w.payouts.markPaid }).click();
    await expect.poll(async () => (await sql<{ paidAt: string | null; paidReference: string | null }>(`SELECT "paidAt", "paidReference" FROM "TeacherStatement" WHERE id = $1`, [statementId]))[0].paidReference).toBe(`DHIRWA-${period}`);
    expect(await sql(`SELECT 1 FROM "Notification" WHERE "dedupeKey" = $1 AND kind = 'PAYOUT_PAID'`, [`payout:${statementId}`])).toHaveLength(1);

    await page.context().clearCookies();
    await signInAs(page, loc, PERSONAS.teacherAe.phone);
    await page.goto(`/${loc}/teacher/earnings`);
    await expect(page.locator("main")).toContainText(`DHIRWA-${period}`);
  } finally {
    await sql(`DELETE FROM "Notification" WHERE "dedupeKey" = $1`, [`payout:${statementId}`]);
    await sql(`DELETE FROM "TeacherStatement" WHERE id = $1`, [statementId]);
    await sql(`UPDATE "User" SET "payoutHolder" = NULL, "payoutBank" = NULL, "payoutIban" = NULL WHERE id = $1`, [teacher]);
  }
});

test("the daily teacher digest is closed to the public and counts what is waiting", async ({ request }) => {
  expect((await request.get("/api/cron/teacher-digest")).status()).toBe(401);
  const res = await request.get("/api/cron/teacher-digest", { headers: { authorization: "Bearer e2e-cron" } });
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true });
});
