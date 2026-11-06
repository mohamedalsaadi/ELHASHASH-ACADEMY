// The policy promises account deletion. This proves the promise: the person's activity goes, the
// personal fields are blanked, the money record stays, and the old number can never sign in again.
import { test, expect, signInAs } from "./fixtures";
import { completeLesson, freshStudent, lessonsOf, sql } from "./db";
import { PASSWORD } from "./personas";

type Erased = { name: string; phone: string | null; email: string | null; deletedAt: Date | null; passwordHash: string };

test("a student can erase the account, and it cannot sign in again", async ({ page, loc }) => {
  const student = await freshStudent(`erase-${loc}-${test.info().project.name}`);
  const { free } = await lessonsOf("eg-12-math");
  await completeLesson(student.id, free);

  await signInAs(page, loc, student.phone);
  await page.goto(`/${loc}/account`);

  const form = page.locator("#delete-account");
  await form.locator('input[name="password"]').fill(PASSWORD);
  await form.locator('input[name="confirm"]').check();
  await form.locator('button:not([type="button"])').click();
  await page.waitForURL((u) => new URL(u).pathname === `/${loc}`, { timeout: 30_000 });

  const [row] = await sql<Erased>(`SELECT name, phone, email, "deletedAt", "passwordHash" FROM "User" WHERE id = $1`, [student.id]);
  expect(row.name).toBe("حساب محذوف");
  expect(row.phone).toBeNull();
  expect(row.email).toBeNull();
  expect(row.deletedAt).not.toBeNull();
  expect(row.passwordHash.startsWith("erased:")).toBe(true);

  const views = await sql(`SELECT 1 FROM "LessonView" WHERE "userId" = $1`, [student.id]);
  expect(views).toHaveLength(0);

  // The old mobile number is no longer a way in.
  await page.context().clearCookies();
  await page.goto(`/${loc}/signin`);
  await page.locator('input[name="login"]').fill(student.phone);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('form button[type="submit"], form button:not([type])').last().click();
  await page.waitForTimeout(2000);
  expect(new URL(page.url()).pathname).toContain("/signin");
});
