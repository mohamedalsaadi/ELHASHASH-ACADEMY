// An exam is course-level work: it opens for the course's staff or for a student with a running plan.
// Before this rule existed, any signed-in account could read a whole paper and sit it for free.
import { test, expect, signInAs } from "./fixtures";
import { courseIdOf, examOf, freshStudent, grantCourseFrom, grantExpired, sitExam } from "./db";
import { PERSONAS } from "./personas";

const COURSE = "ae-12-math-e2e";

test("a signed-in student without a plan is sent back to the course, not shown the paper", async ({ page, loc }) => {
  const s = await freshStudent(`exam-${loc}-${test.info().project.name}`);
  const paperId = await examOf(COURSE);

  await signInAs(page, loc, s.phone);
  await page.goto(`/${loc}/courses/${COURSE}/exams/${paperId}`);

  // Redirected out of the paper.
  await page.waitForURL((u) => !u.pathname.includes(`/exams/${paperId}`), { timeout: 10_000 });
  await expect(page.locator("main")).not.toContainText("2 + 2");
});

test("a plan that starts next term does not open the paper early", async ({ page, loc }) => {
  const s = await freshStudent(`exam-future-${loc}-${test.info().project.name}`);
  const paperId = await examOf(COURSE);
  const courseId = await courseIdOf(COURSE);
  await grantCourseFrom(s.id, courseId, 30);

  await signInAs(page, loc, s.phone);
  await page.goto(`/${loc}/courses/${COURSE}/exams/${paperId}`);

  await page.waitForURL((u) => !u.pathname.includes(`/exams/${paperId}`), { timeout: 10_000 });
});

test("an already-sat paper stays readable after the plan ends", async ({ page, loc }) => {
  const s = await freshStudent(`exam-past-${loc}-${test.info().project.name}`);
  const paperId = await examOf(COURSE);
  const courseId = await courseIdOf(COURSE);
  await grantExpired(s.id, courseId);
  await sitExam(s.id, paperId);

  await signInAs(page, loc, s.phone);
  await page.goto(`/${loc}/courses/${COURSE}/exams/${paperId}`);

  // Not redirected: the student keeps sight of a result they earned.
  await expect(page).toHaveURL(new RegExp(`/exams/${paperId}`));
  await expect(page.locator("main")).toContainText("E2E exam");
});

test("a student holding a plan opens the same paper", async ({ page, loc }) => {
  const paperId = await examOf(COURSE);

  await signInAs(page, loc, PERSONAS.studentAe.phone);
  await page.goto(`/${loc}/courses/${COURSE}/exams/${paperId}`);

  await expect(page).toHaveURL(new RegExp(`/exams/${paperId}`));
  // The paper opens: its title and the start button. Prompts appear only inside a sitting attempt.
  await expect(page.locator("main")).toContainText("E2E exam");
  await expect(page.locator("main form button")).toBeVisible();
});
