// Every role signs in and lands on its own area; every area refuses the wrong roles.
import { test, expect, isRefused, signInAs } from "./fixtures";
import type { Persona } from "./personas";

const AREAS = { admin: "/admin", teacher: "/teacher", parent: "/parent" } as const;
const ALLOWED: Record<keyof typeof AREAS, Persona[]> = {
  admin: ["admin"],
  teacher: ["teacherEg", "teacherAe", "admin"],
  parent: ["parent"],
};
const WHO: Persona[] = ["admin", "teacherEg", "studentEg", "parent"];

test("a wrong password is refused and stays on sign-in", async ({ page, loc }) => {
  await page.goto(`/${loc}/signin`);
  await page.locator('input[name="login"]').fill("0500000004");
  await page.locator('input[name="password"]').fill("wrong-password-1");
  await page.locator("form button").last().click();
  await page.waitForURL(/error=1/);
});

test("signed out, every private area is refused", async ({ page, loc }) => {
  for (const path of [...Object.values(AREAS), "/dashboard", "/account", "/orders/not-an-order"]) {
    expect(await isRefused(page, `/${loc}${path}`), path).toBe(true);
  }
});

for (const who of WHO) {
  test(`${who}: reaches only the areas of its role`, async ({ page, loc, signIn }) => {
    await signIn(who);
    for (const [area, path] of Object.entries(AREAS) as [keyof typeof AREAS, string][]) {
      const refused = await isRefused(page, `/${loc}${path}`);
      expect(refused, `${who} at ${path}`).toBe(!ALLOWED[area].includes(who));
    }
  });
}

test("a wrong-role sign-in cannot reach admin actions by URL", async ({ page, loc }) => {
  await signInAs(page, loc, "0500000005");
  for (const path of ["/admin/teachers", "/admin/orders", "/admin/settings", "/teacher/subjects"]) {
    expect(await isRefused(page, `/${loc}${path}`), path).toBe(true);
  }
});
