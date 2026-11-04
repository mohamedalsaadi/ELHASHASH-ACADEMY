// The signed-in student home is scoped to the student's country, and checkout prices the stored SKU.
import { test, expect } from "./fixtures";

test("Egypt student sees Egypt courses on the home, not UAE ones", async ({ page, loc, signIn }) => {
  await signIn("studentEg");
  await page.goto(`/${loc}`);
  await page.waitForLoadState("networkidle");
  const body = page.locator("body");
  // Either the country step (first visit) or the ride; pick Egypt when asked.
  const egypt = page.getByRole("button", { name: loc === "ar" ? /مصر/ : /Egypt/ });
  if (await egypt.count()) await egypt.first().click();
  await expect(page.locator('main a[href*="/courses/eg-12-"]').first()).toBeVisible();
  await expect(page.locator('main a[href*="/courses/ae-12-math-e2e"]')).toHaveCount(0);
  await expect(body).not.toContainText(/NaN|undefined/);
});

test("checkout shows the course and its stored price before payment", async ({ page, loc, signIn }) => {
  await signIn("studentAe");
  await page.goto(`/${loc}/courses/ae-12-math-e2e`);
  await expect(page.locator("body")).toContainText(/400/);
});

test("parent sees the linked child", async ({ page, loc, signIn }) => {
  await signIn("parent");
  await page.goto(`/${loc}/parent`);
  await expect(page.locator("body")).toContainText("E2E Student Egypt");
});
