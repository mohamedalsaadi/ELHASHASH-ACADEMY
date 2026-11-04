// Access to lessons: the free unit opens for anyone signed in, paid units need an entitlement.
import { test, expect, signInAs } from "./fixtures";
import { freshStudent, grantCourse, lessonsOf } from "./db";

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
