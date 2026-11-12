// A quiz on an outside link (Google Forms): only a subscriber is sent there, the address is not in the page, and each
// student gets a code in place of {student}.
import { randomUUID } from "node:crypto";
import { test, expect, signInAs } from "./fixtures";
import { courseIdOf, freshStudent, grantExpired, sql } from "./db";
import { PERSONAS } from "./personas";
import { studentCode } from "../src/lib/external-link"; // the e2e run and the server share one AUTH_SECRET

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
  const form = page.locator("main form:has(select[name=kind])").first();
  await form.locator("select[name=kind]").selectOption("QUIZ");
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

  // The key is in the script the teacher copies from the assignment page.
  await signInAs(page, loc, PERSONAS.teacherAe.phone);
  await page.goto(`/${loc}/teacher/assignments/${id}`);
  const script = await page.locator("textarea[readonly]").inputValue();
  const key = /const KEY = "([0-9a-f]{32})"/.exec(script)?.[1];
  expect(key).toBeTruthy();

  const ask = (body: object) => page.request.post("/api/quiz-check", { data: { assignment: id, key, code: studentCode(student.id, id), ...body } });
  expect(await (await ask({})).json()).toMatchObject({ status: "ok" });
  expect(await (await ask({ code: studentCode(lapsed.id, id) })).json()).toMatchObject({ status: "not subscribed" });
  expect(await (await ask({ code: "0000000000" })).json()).toEqual({ status: "invalid" });
  expect((await ask({ key: "0".repeat(32) })).status()).toBe(404);
});
