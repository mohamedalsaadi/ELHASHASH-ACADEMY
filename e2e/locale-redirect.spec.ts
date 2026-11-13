// A server action that redirects must keep the visitor's language: an English student starting an exam once landed on the Arabic site.
import { readFileSync } from "node:fs";
import { test, expect, signInAs } from "./fixtures";
import { courseIdOf, freshStudent, grantCourseFrom } from "./db";

const COURSE = "ae-12-math-e2e";

test("starting an exam keeps the language of the page", async ({ page, loc }) => {
  const s = await freshStudent(`locale-${loc}-${test.info().project.name}`);
  await grantCourseFrom(s.id, await courseIdOf(COURSE), 0);
  const start = JSON.parse(readFileSync(`messages/${loc}.json`, "utf8")).exam.start;

  await signInAs(page, loc, s.phone);
  await page.goto(`/${loc}/courses/${COURSE}/exams`);
  await page.getByRole("button", { name: start }).first().click();
  await page.waitForURL(/\/exams\/[^/]+$/, { timeout: 20_000 });

  expect(new URL(page.url()).pathname.startsWith(`/${loc}/`)).toBe(true);
  await expect(page.locator("html")).toHaveAttribute("lang", loc);
});
