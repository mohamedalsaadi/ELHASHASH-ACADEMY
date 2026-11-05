// The instructor comparison block on the subject page: one card per teacher who published a course
// for that grade and subject, including when there is only one.
import { test, expect } from "./fixtures";

const CARDS = "section[aria-labelledby=instructors] li";

test("two teachers on one subject each get a card, linking to their own course", async ({ page, loc }) => {
  await page.goto(`/${loc}/courses/c/ae/12/math`);

  await expect(page.locator("#instructors")).toBeVisible();
  await expect(page.locator(CARDS)).toHaveCount(2);

  const main = page.locator("main");
  await expect(main).toContainText("E2E Teacher UAE");
  await expect(main).toContainText("E2E Teacher Egypt");

  // Each card points at a different course, so choosing a teacher actually chooses a course.
  const hrefs = await page.locator(`${CARDS} a[href*="/courses/"]`).evaluateAll((links) =>
    [...new Set(links.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? "").filter((h) => !h.includes("/teachers/")))],
  );
  expect(hrefs.length).toBeGreaterThanOrEqual(2);
});

test("a subject with one teacher still renders a single card", async ({ page, loc }) => {
  await page.goto(`/${loc}/courses/c/eg/12/math`);

  await expect(page.locator("#instructors")).toBeVisible();
  await expect(page.locator(CARDS)).toHaveCount(1);
});

test("the profile link reaches the teacher page", async ({ page, loc }) => {
  await page.goto(`/${loc}/courses/c/ae/12/math`);
  const link = page.locator(`${CARDS} a[href*="/teachers/"]`).first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/teachers\//);
  await expect(page.locator("main h1")).toBeVisible();
});
