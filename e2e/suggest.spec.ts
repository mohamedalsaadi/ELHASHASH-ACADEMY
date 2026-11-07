// The suggestion box is anonymous: the note lands without a name, contact details typed into it are masked,
// and the owner sees it in the back office.
import { test, expect } from "./fixtures";
import { sql } from "./db";

test("a visitor sends a suggestion, the owner reads it", async ({ page, loc, signIn, isMobile }) => {
  test.skip(isMobile, "rate limited to 5 an hour; covered by the desktop projects");
  const stamp = String(Date.now());
  await page.goto(`/${loc}/suggest`);
  await page.selectOption('select[name="kind"]', "idea");
  await page.fill('textarea[name="message"]', `Please add a dark exam mode ${stamp}, call me on 0501234567`);
  await page.locator("form button").last().click();
  await expect(page.locator('main [role="status"]')).toBeVisible();

  const rows = await sql<{ message: string; role: string; digestId: string | null }>(`SELECT message, role, "digestId" FROM "Suggestion" WHERE message LIKE $1`, [`%${stamp}%`]);
  expect(rows).toHaveLength(1);
  expect(rows[0].role).toBe("VISITOR");
  expect(rows[0].digestId).toBeNull();
  expect(rows[0].message).not.toContain("0501234567");

  await signIn("admin");
  await page.goto(`/${loc}/admin/suggestions`);
  await expect(page.locator("main")).toContainText(stamp);
});

test("the suggestion box refuses a note that is too short", async ({ page, loc }) => {
  await page.goto(`/${loc}/suggest`);
  await page.locator('textarea[name="message"]').evaluate((el: HTMLTextAreaElement) => el.removeAttribute("minlength"));
  await page.fill('textarea[name="message"]', "short");
  await page.locator("form button").last().click();
  await expect(page.locator('[role="alert"]')).toBeVisible();
});
