// Questions with several correct answers, and a quiz set on an assignment. Blob uploads (pictures, PDFs) need a real
// store and are checked by hand; this covers typing a question, answering it, and marking it.
import { randomUUID } from "node:crypto";
import { test, expect, signInAs } from "./fixtures";
import { sql } from "./db";
import { PERSONAS } from "./personas";

const COURSE = "ae-12-math-e2e";

async function seededLesson() {
  return (await sql<{ lessonId: string; courseId: string }>(
    `SELECT q."lessonId", u."courseId" FROM "QuestionItem" q JOIN "Lesson" l ON l.id = q."lessonId" JOIN "Unit" u ON u.id = l."unitId" WHERE q.prompt = '2 + 2 = ?' LIMIT 1`,
  ))[0];
}

test("a teacher writes a several-answer question and a student is marked on exactly the right set", async ({ page, loc }) => {
  const tag = `${loc}-${test.info().project.name}`;
  const prompt = `Pick the even numbers ${tag}`;
  const { lessonId } = await seededLesson();

  await signInAs(page, loc, PERSONAS.teacherAe.phone);
  await page.goto(`/${loc}/teacher/bank/${lessonId}`);
  const form = page.locator("main form:has(select[name=kind])").last();
  await form.locator("select[name=kind]").selectOption("MULTI");
  await form.locator("textarea[name=prompt]").fill(prompt);
  const options = ["2", "3", "4", "5"];
  for (const [i, v] of options.entries()) await form.locator("input[name=choice]").nth(i).fill(v);
  await form.locator("input[name=correct]").nth(0).check();
  await form.locator("input[name=correct]").nth(2).check();
  await form.locator("button").last().click();
  await expect(page.locator("main")).toContainText(prompt);

  const rows = await sql<{ label: string; correct: boolean }>(
    `SELECT c.label, c.correct FROM "QuestionChoice" c JOIN "QuestionItem" q ON q.id = c."itemId" WHERE q.prompt = $1 ORDER BY c."order"`,
    [prompt],
  );
  expect(rows).toEqual([{ label: "2", correct: true }, { label: "3", correct: false }, { label: "4", correct: true }, { label: "5", correct: false }]);

  // The student ticks the two right boxes (and answers the seeded one-answer question, which the form requires).
  await page.context().clearCookies();
  await signInAs(page, loc, PERSONAS.studentAe.phone);
  await page.goto(`/${loc}/courses/${COURSE}/lessons/${lessonId}/practice`);
  const fieldset = page.locator("fieldset", { hasText: prompt });
  await expect(fieldset.locator("input[type=checkbox]")).toHaveCount(4);
  await fieldset.locator("input[type=checkbox]").nth(0).check();
  await fieldset.locator("input[type=checkbox]").nth(2).check();
  for (const radio of await page.locator("fieldset input[type=radio][value]").all()) {
    const label = await radio.locator("xpath=following-sibling::span[last()]").innerText();
    if (label.trim() === "4") await radio.check();
  }
  await page.locator("main form button:not([type=button])").last().click();
  await page.waitForURL(/attempt=/);

  const answer = await sql<{ correct: boolean; n: number }>(
    `SELECT a.correct, cardinality(a."choiceIds") AS n FROM "PracticeAnswer" a JOIN "QuestionItem" q ON q.id = a."itemId" WHERE q.prompt = $1 ORDER BY a.id DESC LIMIT 1`,
    [prompt],
  );
  expect(answer[0]).toMatchObject({ correct: true, n: 2 });
});

test("a quiz set on an assignment is marked on the spot and scaled to its score", async ({ page, loc }) => {
  const tag = `${loc}-${test.info().project.name}`;
  const { courseId } = await seededLesson();
  const item = (await sql<{ id: string }>(`SELECT id FROM "QuestionItem" WHERE prompt = '2 + 2 = ?' LIMIT 1`))[0];
  const teacher = (await sql<{ id: string }>(`SELECT id FROM "User" WHERE phone = $1`, [PERSONAS.teacherAe.phone]))[0];
  const id = randomUUID();
  await sql(`INSERT INTO "Assignment" (id, "courseId", "createdById", kind, title, "maxScore", "updatedAt") VALUES ($1,$2,$3,'QUIZ',$4,50, now())`, [id, courseId, teacher.id, `E2E quiz ${tag}`]);
  await sql(`INSERT INTO "AssignmentItem" (id, "assignmentId", "itemId", "order") VALUES ($1,$2,$3,0)`, [randomUUID(), id, item.id]);

  await signInAs(page, loc, PERSONAS.studentAe.phone);
  await page.goto(`/${loc}/courses/${COURSE}/assignments/${id}`);
  const fieldset = page.locator("fieldset", { hasText: "2 + 2" });
  for (const radio of await fieldset.locator("input[type=radio]").all()) {
    const label = await radio.locator("xpath=following-sibling::span[last()]").innerText();
    if (label.trim() === "4") await radio.check();
  }
  await page.locator("main form button:not([type=button])").last().click();

  await expect.poll(async () => (await sql<{ status: string; score: number }>(`SELECT status, score FROM "Submission" WHERE "assignmentId" = $1`, [id]))[0]?.status).toBe("GRADED");
  const row = (await sql<{ score: number }>(`SELECT score FROM "Submission" WHERE "assignmentId" = $1`, [id]))[0];
  expect(row.score).toBe(50); // the one question is right: full marks, scaled to the assignment's 50
});

test("a teacher adds a true/false question to the course itself, and a student answers it in a quiz", async ({ page, loc }) => {
  const tag = `${loc}-${test.info().project.name}`;
  const prompt = `The sky is blue ${tag}`;
  const { courseId } = await seededLesson();

  await signInAs(page, loc, PERSONAS.teacherAe.phone);
  await page.goto(`/${loc}/admin/courses/${courseId}/questions`);
  const form = page.locator("main form:has(select[name=kind])").first();
  await form.locator("select[name=kind]").selectOption("TRUE_FALSE");
  await form.locator("textarea[name=prompt]").fill(prompt);
  await form.locator("button").last().click();
  await expect(page.locator("main")).toContainText(prompt);

  // It belongs to the course, not to a lesson, and is stored as a one-answer question with two fixed options.
  const q = (await sql<{ id: string; lessonId: string | null; kind: string }>(`SELECT id, "lessonId", kind FROM "QuestionItem" WHERE prompt = $1`, [prompt]))[0];
  expect(q).toMatchObject({ lessonId: null, kind: "MCQ" });
  const choices = await sql<{ label: string; correct: boolean }>(`SELECT label, correct FROM "QuestionChoice" WHERE "itemId" = $1 ORDER BY "order"`, [q.id]);
  expect(choices.map((c) => c.correct)).toEqual([true, false]);

  // A quiz made from it: the student ticks "True" and is graded on the spot.
  const teacher = (await sql<{ id: string }>(`SELECT id FROM "User" WHERE phone = $1`, [PERSONAS.teacherAe.phone]))[0];
  const id = randomUUID();
  await sql(`INSERT INTO "Assignment" (id, "courseId", "createdById", kind, title, "maxScore", "updatedAt") VALUES ($1,$2,$3,'QUIZ',$4,10, now())`, [id, courseId, teacher.id, `E2E tf quiz ${tag}`]);
  await sql(`INSERT INTO "AssignmentItem" (id, "assignmentId", "itemId", "order") VALUES ($1,$2,$3,0)`, [randomUUID(), id, q.id]);
  await page.context().clearCookies();
  await signInAs(page, loc, PERSONAS.studentAe.phone);
  await page.goto(`/${loc}/courses/${COURSE}/assignments/${id}`);
  await page.locator("fieldset", { hasText: prompt }).locator("label", { hasText: "True" }).locator("input").check();
  await page.locator("main form button:not([type=button])").last().click();
  await expect.poll(async () => (await sql<{ status: string }>(`SELECT status FROM "Submission" WHERE "assignmentId" = $1`, [id]))[0]?.status).toBe("GRADED");
  expect((await sql<{ score: number }>(`SELECT score FROM "Submission" WHERE "assignmentId" = $1`, [id]))[0].score).toBe(10);
});
