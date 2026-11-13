// A quiz on an outside link (Google Forms): only a subscriber is sent there, the address is not in the page, and each
// student gets a code in place of {student}.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test, expect, signInAs } from "./fixtures";
import { courseIdOf, freshStudent, grantExpired, sql } from "./db";
import { PERSONAS } from "./personas";
import { checkKey, studentCode } from "../src/lib/external-link"; // the e2e run and the server share one AUTH_SECRET

const homeworkWords = (loc: string) => JSON.parse(readFileSync(`messages/${loc}.json`, "utf8")).homework;

const COURSE = "ae-12-math-e2e";
const FORM = "https://docs.google.com/forms/d/e/e2e-form/viewform?usp=pp_url&entry.111={student}";

async function outsideQuiz(tag: string) {
  const courseId = await courseIdOf(COURSE);
  const teacher = (await sql<{ id: string }>(`SELECT id FROM "User" WHERE phone = $1`, [PERSONAS.teacherAe.phone]))[0];
  const id = randomUUID();
  await sql(`INSERT INTO "Assignment" (id, "courseId", "createdById", kind, title, "linkUrl", "updatedAt") VALUES ($1,$2,$3,'QUIZ',$4,$5, now())`, [id, courseId, teacher.id, `E2E outside quiz ${tag}`, FORM]);
  return { id, courseId };
}

test("a subscriber is sent to the form with their own code, and the address is not in the page", async ({ page, loc }) => {
  const { id } = await outsideQuiz(`${loc}-${test.info().project.name}`);
  await signInAs(page, loc, PERSONAS.studentAe.phone);

  await page.goto(`/${loc}/courses/${COURSE}/assignments/${id}`);
  await expect(page.locator(`a[href="/api/out/${id}"]`)).toBeVisible();
  expect(await page.content()).not.toContain("docs.google.com");

  const res = await page.request.get(`/api/out/${id}`, { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  const to = new URL(res.headers()["location"]);
  expect(to.hostname).toBe("docs.google.com");
  expect(to.searchParams.get("entry.111")).toMatch(/^[0-9A-F]{10}$/); // the placeholder became a code
  expect(res.headers()["cache-control"]).toContain("no-store");
});

test("someone without a running plan, or a signed-out visitor, gets nothing", async ({ page, loc }) => {
  const { id, courseId } = await outsideQuiz(`none-${loc}-${test.info().project.name}`);

  expect((await page.request.get(`/api/out/${id}`, { maxRedirects: 0 })).status()).toBe(404); // signed out

  const lapsed = await freshStudent(`lapsed-${loc}-${test.info().project.name}`);
  await grantExpired(lapsed.id, courseId);
  await signInAs(page, loc, lapsed.phone);
  expect((await page.request.get(`/api/out/${id}`, { maxRedirects: 0 })).status()).toBe(404);
});

test("a teacher cannot save a quiz link that is not Google Forms", async ({ page, loc }) => {
  await signInAs(page, loc, PERSONAS.teacherAe.phone);
  await page.goto(`/${loc}/teacher/assignments/new`);
  const form = page.locator("main form:has(input[name=title])").first();
  await form.getByText(homeworkWords(loc).typeForm, { exact: true }).click();
  await form.locator("input[name=title]").fill(`Bad link ${loc}-${test.info().project.name}`);
  await form.locator("input[name=linkUrl]").fill("https://example.com/quiz");
  await form.locator("button").last().click();
  await expect(form.locator("[role=alert]")).toBeVisible();
  expect((await sql<{ n: number }>(`SELECT count(*)::int AS n FROM "Assignment" WHERE "linkUrl" = 'https://example.com/quiz'`))[0].n).toBe(0);
});

test("the form script's check marks a subscriber ok, a lapsed plan not subscribed, and a wrong code or key gets nothing", async ({ page, loc }) => {
  const tag = `${loc}-${test.info().project.name}`;
  const { id, courseId } = await outsideQuiz(`check-${tag}`);
  const student = (await sql<{ id: string }>(`SELECT id FROM "User" WHERE phone = $1`, [PERSONAS.studentAe.phone]))[0];
  const lapsed = await freshStudent(`lapsed-check-${tag}`);
  await grantExpired(lapsed.id, courseId);

  // The key is only in the generated script (no longer on the page), so it is derived the same way the server does.
  const key = checkKey(id);

  const ask = (body: object) => page.request.post("/api/quiz-check", { data: { assignment: id, key, code: studentCode(student.id, id), ...body } });
  expect(await (await ask({})).json()).toMatchObject({ status: "ok" });
  expect(await (await ask({ code: studentCode(lapsed.id, id) })).json()).toMatchObject({ status: "not subscribed" });
  expect(await (await ask({ code: "0000000000" })).json()).toEqual({ status: "invalid" });
  expect((await ask({ key: "0".repeat(32) })).status()).toBe(404);
});

test("a quiz whose form has a Student code question gets the code in its own field, and the teacher can check a responses file", async ({ page, loc }) => {
  const tag = `${loc}-${test.info().project.name}`;
  const { id, courseId } = await outsideQuiz(`entry-${tag}`);
  // The form link has no {student}: the field id was found when the link was saved.
  await sql(`UPDATE "Assignment" SET "linkUrl" = $2, "linkEntry" = $3 WHERE id = $1`, [id, "https://docs.google.com/forms/d/e/e2e-form/viewform", "1691794639"]);
  const student = (await sql<{ id: string }>(`SELECT id FROM "User" WHERE phone = $1`, [PERSONAS.studentAe.phone]))[0];
  const lapsed = await freshStudent(`lapsed-entry-${tag}`);
  await grantExpired(lapsed.id, courseId);

  await signInAs(page, loc, PERSONAS.studentAe.phone);
  const res = await page.request.get(`/api/out/${id}`, { maxRedirects: 0 });
  const to = new URL(res.headers()["location"]);
  expect(to.pathname).toBe("/forms/d/e/e2e-form/viewform");
  expect(to.searchParams.get("entry.1691794639")).toBe(studentCode(student.id, id));

  // Responses downloaded from the form: a good code, a lapsed plan, an unknown code, the good code again, and a blank.
  const ok = studentCode(student.id, id);
  const csv = ["Timestamp,Score,Student code", `1,5,${ok}`, `2,4,${studentCode(lapsed.id, id)}`, "3,2,0000000000", `4,5,${ok.toLowerCase()}`, "5,1,"].join("\n");
  await signInAs(page, loc, PERSONAS.teacherAe.phone);
  await page.goto(`/${loc}/teacher/assignments/${id}`);
  await page.locator("input[type=file][name=file]").setInputFiles({ name: "responses.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.locator("form:has(input[type=file][name=file]) button").first().click();
  const words = homeworkWords(loc);
  const rows = page.locator("table tbody tr");
  await expect(rows).toHaveCount(5);
  await expect(rows.nth(0)).toContainText(PERSONAS.studentAe.name);
  await expect(rows.nth(0)).toContainText(words.vOk);
  await expect(rows.nth(1)).toContainText(words.vNot);
  await expect(rows.nth(2)).toContainText(words.vBad);
  await expect(rows.nth(3)).toContainText(words.vDup);
  await expect(rows.nth(4)).toContainText(words.vNone);

  // Save scores: only a good code used once is kept; a repeat upload updates the same row instead of adding one.
  const upload = async (text: string) => {
    await page.locator("input[type=file][name=file]").setInputFiles({ name: "responses.csv", mimeType: "text/csv", buffer: Buffer.from(text) });
    await page.locator("form:has(input[type=file][name=file]) button").last().click();
  };
  const scoreOf = async () => (await sql<{ score: number | null; status: string }>(`SELECT score, status::text FROM "Submission" WHERE "assignmentId" = $1 AND "studentId" = $2`, [id, student.id]));
  await upload(["Timestamp,Score,Student code", `1,8 / 10,${ok}`, `2,4 / 10,${studentCode(lapsed.id, id)}`, "3,2 / 10,0000000000"].join("\n"));
  await expect(page.locator("main p[role=status]")).toBeVisible();
  await expect.poll(async () => (await scoreOf())[0]?.score).toBe(80);
  expect((await sql<{ n: number }>(`SELECT count(*)::int AS n FROM "Submission" WHERE "assignmentId" = $1`, [id]))[0].n).toBe(1);
  await upload(["Timestamp,Score,Student code", `1,9 / 10,${ok}`].join("\n"));
  await expect.poll(async () => (await scoreOf())[0]?.score).toBe(90);
  expect(await scoreOf()).toHaveLength(1);
  expect((await scoreOf())[0].status).toBe("GRADED");

  // The student sees the score, and nothing to type or upload.
  await signInAs(page, loc, PERSONAS.studentAe.phone);
  await page.goto(`/${loc}/courses/${COURSE}/assignments/${id}`);
  await expect(page.locator("main")).toContainText("90 / 100");
  await expect(page.locator("textarea[name=text]")).toHaveCount(0);
  await expect(page.locator(`a[href="/api/out/${id}"]`)).toBeVisible();
});

test("a teacher making a Google quiz is asked only for a title, the link, a due date, and the lesson with its required switch", async ({ page, loc }) => {
  await signInAs(page, loc, PERSONAS.teacherAe.phone);
  await page.goto(`/${loc}/teacher/assignments/new`);
  const form = page.locator("main form:has(input[name=title])").first();
  await form.getByText(homeworkWords(loc).typeForm, { exact: true }).click();
  await expect(form.locator("input[name=title]")).toBeVisible();
  await expect(form.locator("input[name=linkUrl]")).toBeVisible();
  await expect(form.locator("input[name=dueAt]")).toBeVisible();
  await expect(form.locator("textarea[name=instructions], textarea[name=rubric], input[type=file]")).toHaveCount(0);
  await expect(form.locator("input[name=maxScore]")).toBeHidden(); // inside the closed More options
});

test("the teacher guide for Google Form quizzes opens for a teacher and links the template", async ({ page, loc }) => {
  await signInAs(page, loc, PERSONAS.teacherAe.phone);
  await page.goto(`/${loc}/teacher/guide/google-forms`);
  const words = JSON.parse(readFileSync(`messages/${loc}.json`, "utf8")).quizGuide;
  await expect(page.locator("h1")).toHaveText(words.title);
  await expect(page.locator("ol > li")).toHaveCount(4);
  await expect(page.getByRole("link", { name: words.template })).toHaveAttribute("href", /docs\.google\.com\/forms\/d\/.+\/copy$/);
});
