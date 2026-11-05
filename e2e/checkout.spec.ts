// Checkout up to the payment step. No gateway key exists in the e2e environment, so nothing can be charged.
import { test, expect } from "./fixtures";

test("signed out, checkout sends you to sign-in and keeps the cart", async ({ page, loc }) => {
  await page.goto(`/${loc}/courses/ae-12-math-e2e`);
  const href = await page.locator('a[href*="/checkout?sku="]').first().getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!);
  await page.waitForURL(/signin/);
  expect(decodeURIComponent(page.url())).toContain("/checkout?sku=");
});

test("signed in, checkout lists the course with the stored price and total", async ({ page, loc, signIn }) => {
  // studentAe now owns this course through the live-lecture seed, so the price is shown to a student who does not.
  await signIn("studentAe2");
  await page.goto(`/${loc}/courses/ae-12-math-e2e`);
  await page.locator('a[href*="/checkout?sku="]').first().click();
  await page.waitForURL(/\/checkout\?sku=/);
  const main = page.locator("main");
  await expect(main).toContainText(loc === "ar" ? "الرياضيات، الصف الثاني عشر" : "Mathematics, Grade 12");
  await expect(main).toContainText(/400/);
  await expect(main).not.toContainText(/NaN|undefined/);
});

test("an unknown SKU shows the unavailable page, not an error", async ({ page, loc, signIn }) => {
  await signIn("studentAe");
  await page.goto(`/${loc}/checkout?sku=does-not-exist`);
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/NaN|undefined|digest/i);
  await expect(page.locator('main a[href$="/courses"]')).toBeVisible();
});
