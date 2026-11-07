// A teacher applies on /teach, cannot sign in while pending, the admin approves, then the teacher signs in.
// Desktop projects only: /teach allows 3 applications an hour per address.
import { test, expect, signInAs } from "./fixtures";

test("teacher application → admin approval → teacher sign-in", async ({ page, loc, signIn, isMobile }) => {
  test.skip(isMobile, "rate limited to 3 an hour; covered by the desktop projects");
  const phone = loc === "ar" ? "0500000101" : "0500000102";
  const name = `E2E Applicant ${loc}`;

  await page.goto(`/${loc}/teach`);
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="email"]').fill(`applicant-${loc}@example.test`);
  await page.locator('input[type="tel"]').fill(phone);
  await page.locator('input[name="countryId"]').first().check();
  await page.locator('input[name="subjectsNote"]').fill("Mathematics");
  await page.locator('input[name="password"]').fill("applicant-pass-1");
  await page.locator("form button").last().click();
  await expect(page.locator('input[name="subjectsNote"]')).toHaveCount(0);

  // Pending: no account yet.
  await page.goto(`/${loc}/signin`);
  await page.locator('input[name="login"]').fill(phone);
  await page.locator('input[name="password"]').fill("applicant-pass-1");
  await page.locator("form button").last().click();
  await page.waitForURL(/error=1/);

  await signIn("admin");
  await page.goto(`/${loc}/admin/teachers`);
  const row = page.locator("li", { hasText: name });
  await expect(row).toBeVisible();
  await row.locator("form").first().locator("button").click();
  await expect(page.locator("li", { hasText: name })).toHaveCount(0);

  await page.context().clearCookies();
  await signInAs(page, loc, phone, "applicant-pass-1");
  await page.goto(`/${loc}/teacher`);
  await expect(page).toHaveURL(new RegExp(`/${loc}/teacher`));
  await expect(page.locator("[data-not-found]")).toHaveCount(0);
});
