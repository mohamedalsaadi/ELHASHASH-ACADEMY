// An exam is course-level work: it opens for the course's staff or for a student with a running plan.
// Before this rule existed, any signed-in account could read a whole paper and sit it for free.
import { test, expect, signInAs } from "./fixtures";
import { examOf, freshStudent } from "./db";
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

test("a student holding a plan opens the same paper", async ({ page, loc }) => {
  const paperId = await examOf(COURSE);

  await signInAs(page, loc, PERSONAS.studentAe.phone);
  await page.goto(`/${loc}/courses/${COURSE}/exams/${paperId}`);

  await expect(page).toHaveURL(new RegExp(`/exams/${paperId}`));
  // The paper opens: its title and the start button. Prompts appear only inside a sitting attempt.
  await expect(page.locator("main")).toContainText("E2E exam");
  await expect(page.locator("main form button")).toBeVisible();
});
