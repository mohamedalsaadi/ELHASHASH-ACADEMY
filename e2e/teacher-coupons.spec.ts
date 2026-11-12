// Discount codes for teachers: only a teacher the admin allowed can make them, only for their own course, only up to their limit.
import { test, expect, signInAs, isRefused } from "./fixtures";
import { sql } from "./db";
import { PERSONAS } from "./personas";

const setFlag = (on: boolean) => sql(`UPDATE "User" SET "canManageCoupons" = $2 WHERE phone = $1`, [PERSONAS.teacherAe.phone, on]);

test("a teacher the admin has not allowed gets no discount-code page", async ({ page, loc }) => {
  await setFlag(false);
  await signInAs(page, loc, PERSONAS.teacherAe.phone);
  expect(await isRefused(page, `/${loc}/teacher/coupons`)).toBe(true);
});

test("an allowed teacher makes a code for their own course, within their limit", async ({ page, loc }) => {
  const tag = `${loc}${test.info().project.name}`.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  await setFlag(true);
  try {
    await signInAs(page, loc, PERSONAS.teacherAe.phone);
    await page.goto(`/${loc}/teacher/coupons`);
    const form = page.locator("main form:has(input[name=code])").first();

    // Above the limit (the default is 10%): refused, nothing saved.
    await form.locator("input[name=code]").fill(`BIG${tag}`);
    await form.locator("input[name=percentOff]").evaluate((el) => el.removeAttribute("max"));
    await form.locator("input[name=percentOff]").fill("50");
    await form.locator("button").last().click();
    await expect(form.locator("[role=alert]")).toBeVisible();
    expect((await sql<{ n: number }>(`SELECT count(*)::int AS n FROM "Coupon" WHERE code = $1`, [`BIG${tag}`]))[0].n).toBe(0);

    // Within the limit: saved as the teacher's own, funded by the teacher, limited to their course.
    await form.locator("input[name=code]").fill(`OK${tag}`);
    await form.locator("input[name=percentOff]").fill("5");
    await form.locator("button").last().click();
    await expect(form.locator("[role=status]")).toBeVisible();
    const row = (await sql<{ percentOff: number; funding: string; instructor: string; course: string }>(
      `SELECT c."percentOff", c.funding, u.phone AS instructor, co.slug AS course FROM "Coupon" c JOIN "User" u ON u.id = c."instructorId" JOIN "Course" co ON co.id = c."courseId" WHERE c.code = $1`,
      [`OK${tag}`],
    ))[0];
    expect(row).toEqual({ percentOff: 5, funding: "STANDARD", instructor: PERSONAS.teacherAe.phone, course: "ae-12-math-e2e" });
  } finally {
    await setFlag(false);
  }
});

test("a teacher cannot make a code for a course that is not theirs", async ({ page, loc }) => {
  const tag = `${loc}${test.info().project.name}`.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  await setFlag(true);
  try {
    await signInAs(page, loc, PERSONAS.teacherAe.phone);
    await page.goto(`/${loc}/teacher/coupons`);
    const other = (await sql<{ id: string }>(`SELECT c.id FROM "Course" c JOIN "User" u ON u.id = c."instructorId" WHERE u.phone <> $1 LIMIT 1`, [PERSONAS.teacherAe.phone]))[0];
    const form = page.locator("main form:has(input[name=code])").first();
    // Offer the other teacher's course in the select, as a tampered form would.
    await form.locator("select[name=courseId]").evaluate((el, id) => {
      const o = document.createElement("option");
      o.value = id; o.textContent = "x";
      el.appendChild(o);
      (el as HTMLSelectElement).value = id;
    }, other.id);
    await form.locator("input[name=code]").fill(`STEAL${tag}`);
    await form.locator("input[name=percentOff]").fill("5");
    await form.locator("button").last().click();
    await page.waitForTimeout(1500);
    expect((await sql<{ n: number }>(`SELECT count(*)::int AS n FROM "Coupon" WHERE code = $1`, [`STEAL${tag}`]))[0].n).toBe(0);
  } finally {
    await setFlag(false);
  }
});
