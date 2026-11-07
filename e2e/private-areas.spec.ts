// Private areas answer a signed-out visitor with a real redirect, and public pages with similar names stay open.
import { test, expect } from "./fixtures";

test("a signed-out visitor is redirected from every private area", async ({ page, loc }) => {
  for (const area of ["admin", "admin/settings", "teacher", "parent", "orders", "account", "dashboard"]) {
    await page.goto(`/${loc}/${area}`);
    await expect(page, area).toHaveURL(new RegExp(`/${loc}/signin[?]next=`));
  }
});

test("public pages whose names start like a private area stay open", async ({ page, loc }) => {
  const teach = await page.goto(`/${loc}/teach`);
  expect(teach?.status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(`/${loc}/teach$`));

  // There is no /teachers index, but the rule must not send it to sign-in: only a profile page lives under it.
  await page.goto(`/${loc}/teachers`);
  await expect(page).not.toHaveURL(/signin/);
});

test("the unsubscribe link refuses a forged signature", async ({ request }) => {
  const res = await request.get("/api/unsubscribe?u=someone&s=forged");
  expect(res.status()).toBe(400);
  expect((await request.post("/api/unsubscribe?u=someone&s=forged")).status()).toBe(400);
});
