// The two access-control promises the audit asked to be proven with tests, not by reading:
// the parent-link code is rate limited, and a password reset ends sessions that were already open.
import { test, expect, signInAs } from "./fixtures";
import { freshParent, freshStudent, parentLinkExists, setParentCode, userWithResetToken } from "./db";

test("the parent-link code stops working after ten wrong tries", async ({ page, loc }) => {
  const tag = `${loc}-${test.info().project.name}`;
  const student = await freshStudent(`link-${tag}`);
  const parent = await freshParent(`link-${tag}`);
  await setParentCode(student.id, "424242");

  await signInAs(page, loc, parent.phone);
  await page.goto(`/${loc}/parent`);

  const form = page.locator('form:has(input[name="code"])');
  const phone = form.locator('input[name="phone"]');
  const code = form.locator('input[name="code"]');

  // Each attempt waits for its own server action, so a skipped submit cannot make the counter
  // fall short of ten and leave the assertion passing for the wrong reason.
  const submit = async () => {
    await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), form.locator("button").click()]);
  };

  for (let i = 0; i < 10; i++) {
    await phone.fill(student.phone);
    await code.fill(String(100000 + i));
    await submit();
  }

  // The correct code is refused too: the window is spent, which is the whole point of the limit.
  await phone.fill(student.phone);
  await code.fill("424242");
  await submit();
  await page.waitForTimeout(400);

  expect(await parentLinkExists(parent.id, student.id), "a link was created despite the limit").toBe(false);
});

test("a password reset ends the session that was already signed in", async ({ page, loc }) => {
  const { phone, raw } = await userWithResetToken(`invalidate-${loc}-${test.info().project.name}`);

  await signInAs(page, loc, phone);
  // /account, not /dashboard: this user has no grade, so the dashboard sends it to complete its profile.
  await page.goto(`/${loc}/account`);
  await expect(page).toHaveURL(new RegExp(`/${loc}/account`));

  await page.goto(`/${loc}/reset/${raw}`);
  await page.locator('input[name="password"]').fill("brand-new-pass-9");
  await page.locator("form button").last().click();
  await page.waitForURL(/signin\?reset=1/);

  // Same cookie jar, older token: the app must no longer honour it.
  await page.goto(`/${loc}/dashboard`);
  await page.waitForURL(/signin/, { timeout: 20_000 });
});
