// An unpublished course opens for the admin and for its own teacher, so they can check it before it goes live.
// A student, another teacher and a signed-out visitor still get the not-found page.
import { test, expect, isRefused } from "./fixtures";
import { sql } from "./db";

const SLUG = "ae-12-math-e2e";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await sql(`UPDATE "Course" SET published = false WHERE slug = $1`, [SLUG]);
});
test.afterAll(async () => {
  await sql(`UPDATE "Course" SET published = true WHERE slug = $1`, [SLUG]);
});

const banner = (loc: string) => (loc === "ar" ? "معاينة مسودة" : "Draft preview");

test("the admin can open a draft course and sees the draft banner", async ({ page, signIn, loc }) => {
  await signIn("admin");
  expect(await isRefused(page, `/${loc}/courses/${SLUG}`)).toBe(false);
  await expect(page.getByText(banner(loc))).toBeVisible();
});

test("the course's own teacher can open it", async ({ page, signIn, loc }) => {
  await signIn("teacherAe");
  expect(await isRefused(page, `/${loc}/courses/${SLUG}`)).toBe(false);
  await expect(page.getByText(banner(loc))).toBeVisible();
});

test("another teacher, a student and a signed-out visitor cannot", async ({ page, signIn, loc, browser, baseURL }) => {
  await signIn("teacherEg");
  expect(await isRefused(page, `/${loc}/courses/${SLUG}`)).toBe(true);
  await page.context().clearCookies();
  await signIn("studentAe");
  expect(await isRefused(page, `/${loc}/courses/${SLUG}`)).toBe(true);
  const guest = await (await browser.newContext({ baseURL })).newPage();
  expect(await isRefused(guest, `/${loc}/courses/${SLUG}`)).toBe(true);
});

test("a published course shows no draft banner", async ({ page, signIn, loc }) => {
  await sql(`UPDATE "Course" SET published = true WHERE slug = $1`, [SLUG]);
  try {
    await signIn("admin");
    await page.goto(`/${loc}/courses/${SLUG}`);
    await expect(page.getByText(banner(loc))).toHaveCount(0);
  } finally {
    await sql(`UPDATE "Course" SET published = false WHERE slug = $1`, [SLUG]);
  }
});
