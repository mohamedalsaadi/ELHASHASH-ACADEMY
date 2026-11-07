// Password reset: the email link is simulated by writing the token the email would carry.
import { test, expect, signInAs } from "./fixtures";
import { userWithResetToken } from "./db";

test("a reset link sets a new password, and works only once", async ({ page, loc }) => {
  const { phone, raw } = await userWithResetToken(`${loc}-${test.info().project.name}`);
  await page.goto(`/${loc}/reset/${raw}`);
  await page.locator('input[name="password"]').fill("brand-new-pass-1");
  await page.locator("form button").last().click();
  await page.waitForURL(/signin\?reset=1/);

  await signInAs(page, loc, phone, "brand-new-pass-1");

  // The same link is spent.
  await page.context().clearCookies();
  await page.goto(`/${loc}/reset/${raw}`);
  await page.locator('input[name="password"]').fill("another-pass-123");
  await page.locator("form button").last().click();
  await expect(page.locator("main [role=alert]")).toBeVisible();
});

test("a too-short password is refused", async ({ page, loc }) => {
  const { raw } = await userWithResetToken(`short-${loc}-${test.info().project.name}`);
  await page.goto(`/${loc}/reset/${raw}`);
  // minLength is on the input; bypass it to prove the server refuses too.
  await page.locator('input[name="password"]').evaluate((el: HTMLInputElement) => el.removeAttribute("minlength"));
  await page.locator('input[name="password"]').fill("short");
  await page.locator("form button").last().click();
  await expect(page.locator("main [role=alert]")).toBeVisible();
});

test("the forgot form answers the same for a known and an unknown email", async ({ page, loc }) => {
  const answers: string[] = [];
  for (const email of ["nobody-here@example.test", "reset-known@example.test"]) {
    await page.goto(`/${loc}/forgot`);
    await page.locator('input[name="email"]').fill(email);
    await page.locator("form button").last().click();
    const status = page.locator("main [role=status]").filter({ hasText: /\S/ });
    await status.waitFor();
    answers.push(await status.innerText());
  }
  expect(answers[0]).toBe(answers[1]);
});
