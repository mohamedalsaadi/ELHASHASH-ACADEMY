// Access to lessons: the free unit opens for anyone signed in, paid units need an entitlement.
import { test, expect, signInAs } from "./fixtures";
import { completeLesson, freshStudent, grantCourse, lessonsOf } from "./db";

test("paid lessons are closed until the course is bought, free ones are open", async ({ page, loc }) => {
  const s = await freshStudent(`lesson-${loc}-${test.info().project.name}`);
  const { free, paid, courseId } = await lessonsOf("eg-12-math");
  await signInAs(page, loc, s.phone);

  await page.goto(`/${loc}/courses/eg-12-math/lessons/${free}`);
  await expect(page).toHaveURL(new RegExp(`/lessons/${free}`));
  await expect(page.locator("main h1")).toBeVisible();

  await page.goto(`/${loc}/courses/eg-12-math/lessons/${paid}`);
  await page.waitForURL(/\/courses\/eg-12-math(#packages)?$/);

  await grantCourse(s.id, courseId);
  await page.goto(`/${loc}/courses/eg-12-math/lessons/${paid}`);
  await expect(page).toHaveURL(new RegExp(`/lessons/${paid}`));
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/NaN|undefined/);
});

test("a signed-out visitor cannot open a paid lesson", async ({ page, loc }) => {
  const { paid } = await lessonsOf("eg-12-math");
  await page.goto(`/${loc}/courses/eg-12-math/lessons/${paid}`);
  await page.waitForLoadState("networkidle");
  await page.waitForURL((u) => !u.pathname.includes(`/lessons/${paid}`), { timeout: 5_000 });
});

test("a finished lesson takes a one-tap confidence answer", async ({ page, loc }) => {
  const s = await freshStudent(`conf-${loc}-${test.info().project.name}`);
  const { paid, courseId } = await lessonsOf("eg-12-math");
  await grantCourse(s.id, courseId);
  await completeLesson(s.id, paid);

  await signInAs(page, loc, s.phone);
  await page.goto(`/${loc}/courses/eg-12-math/lessons/${paid}`);

  const got = page.locator('button[name="confidence"][value="GOT_IT"]');
  await expect(got).toHaveAttribute("aria-pressed", "false");
  await got.click();
  // The action revalidates the page; the same tap now reads as the student's current answer.
  await expect(page.locator('button[name="confidence"][value="GOT_IT"]')).toHaveAttribute("aria-pressed", "true");
});

test("the course page shows a readiness score built from stored activity", async ({ page, loc }) => {
  const s = await freshStudent(`ready-${loc}-${test.info().project.name}`);
  const { paid, courseId } = await lessonsOf("eg-12-math");
  await grantCourse(s.id, courseId);
  await completeLesson(s.id, paid);

  await signInAs(page, loc, s.phone);
  await page.goto(`/${loc}/courses/eg-12-math`);

  const card = page.locator("[data-readiness]");
  await expect(card).toHaveCount(1);
  const score = Number(await card.getAttribute("data-readiness"));
  expect(Number.isInteger(score)).toBe(true);
  expect(score).toBeGreaterThanOrEqual(0);
  expect(score).toBeLessThanOrEqual(100);
  // One finished lesson and no practice: the card must say so rather than look exam-ready.
  expect(score).toBeLessThanOrEqual(55);
  await expect(page.locator("main")).not.toContainText(/NaN|undefined/);
});
