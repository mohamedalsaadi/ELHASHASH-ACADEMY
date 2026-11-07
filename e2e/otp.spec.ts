// Phone sign-in with a WhatsApp code. Runs only when the run has WhatsApp configured (see docs/whatsapp-otp.md for the stub
// command): the sender is pointed at a local stand-in, and the test plants a code whose hash it knows.
import { test, expect } from "./fixtures";
import { sql } from "./db";
import { createHmac } from "node:crypto";

// The same keyed hash as src/lib/otp.ts, written out here because Playwright cannot import that module (it reaches the Prisma client).
const SECRET = "e2e-only-secret-not-used-anywhere-else-0123456789";
const hashCode = (phone: string, code: string) => createHmac("sha256", SECRET).update(`otp:${phone}:${code}`).digest("hex");

async function plantCode(phone: string, code: string) {
  await sql(`DELETE FROM "OtpCode" WHERE phone = $1`, [phone]);
  await sql(`INSERT INTO "OtpCode"(id, phone, "codeHash", "expiresAt") VALUES (gen_random_uuid()::text, $1, $2, now() + interval '10 minutes')`, [phone, hashCode(phone, code)]);
}

test("a new number signs up with a WhatsApp code, then signs back in with a code", async ({ page, loc, isMobile }) => {
  test.skip(!process.env.WHATSAPP_PHONE_NUMBER_ID, "needs the WhatsApp stand-in");
  test.skip(isMobile, "rate limited; covered by the desktop projects");
  const national = `5${String(Date.now()).slice(-8)}`;
  const phone = `+971${national}`;

  await page.goto(`/${loc}/signin`);
  await page.fill('input[type="tel"]', national);
  await page.locator('form button').last().click();
  await expect(page.locator('input[name="code"]')).toBeVisible();

  // A wrong code is refused and counted.
  await plantCode(phone, "123456");
  await page.fill('input[name="code"]', "000000");
  await page.locator('form button[name="step"][value="code"]').click();
  await expect(page.locator("#otp-error")).toBeVisible();

  await page.fill('input[name="code"]', "123456");
  await page.locator('form button[name="step"][value="code"]').click();
  await expect(page.locator('input[name="name"]')).toBeVisible();

  await page.fill('input[name="name"]', "E2E Phone Student");
  await page.selectOption('select[name="gradeId"]', { index: 1 });
  await page.fill('input[name="dateOfBirth"]', "1990-01-01");
  await page.check('input[name="acceptTerms"]');
  await page.locator("form button").last().click();
  await page.waitForURL((u) => !u.pathname.endsWith("/signin"), { timeout: 30_000 });
  await expect(page).toHaveURL(new RegExp(`/${loc}/?$`));

  const rows = await sql<{ role: string; termsAcceptedAt: string | null; email: string | null }>(`SELECT role, "termsAcceptedAt", email FROM "User" WHERE phone = $1`, [phone]);
  expect(rows).toHaveLength(1);
  expect(rows[0].role).toBe("STUDENT");
  expect(rows[0].termsAcceptedAt).not.toBeNull();
  expect(rows[0].email).toBeNull();

  // Back again: the same number goes straight in, with no profile step.
  await page.context().clearCookies();
  await page.goto(`/${loc}/signin`);
  await page.fill('input[type="tel"]', national);
  await page.locator('form button').last().click();
  await expect(page.locator('input[name="code"]')).toBeVisible();
  await plantCode(phone, "654321");
  await page.fill('input[name="code"]', "654321");
  await page.locator('form button[name="step"][value="code"]').click();
  await page.waitForURL((u) => !u.pathname.endsWith("/signin"), { timeout: 30_000 });
  await expect(page.locator('input[name="name"]')).toHaveCount(0);
});

test("a code cannot open a teacher or admin account", async ({ page, loc, isMobile }) => {
  test.skip(!process.env.WHATSAPP_PHONE_NUMBER_ID, "needs the WhatsApp stand-in");
  test.skip(isMobile, "rate limited; covered by the desktop projects");
  const national = `5${String(Date.now()).slice(-8)}`;
  const phone = `+971${national}`;
  await sql(
    `INSERT INTO "User"(id, name, phone, "passwordHash", role, locale) VALUES (gen_random_uuid()::text, 'E2E Staff', $1, 'x', 'INSTRUCTOR', 'en')`,
    [phone],
  );
  await page.goto(`/${loc}/signin`);
  await page.fill('input[type="tel"]', national);
  await page.locator('form button').last().click();
  await expect(page.locator('input[name="code"]')).toBeVisible();
  await plantCode(phone, "111111");
  await page.fill('input[name="code"]', "111111");
  await page.locator('form button[name="step"][value="code"]').click();
  await expect(page.locator("#otp-error")).toBeVisible();
  await expect(page).toHaveURL(/signin/);
});
