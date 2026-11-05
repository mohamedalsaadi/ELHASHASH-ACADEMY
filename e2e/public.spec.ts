import { test, expect } from "./fixtures";

test("home renders in the right language and direction, with the intro mark", async ({ page, loc }) => {
  await page.goto(`/${loc}`);
  await expect(page.locator("html")).toHaveAttribute("lang", loc);
  await expect(page.locator("html")).toHaveAttribute("dir", loc === "ar" ? "rtl" : "ltr");
  await expect(page.locator(".as-hop [data-dot]")).toHaveCount(1);
  // The intro guard is a same-origin file, not an inline script, so the CSP can forbid inline script.
  await expect(page.locator('script[src="/intro-guard.js"]')).toHaveCount(1);
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/sabboura|aacademy|a\+ academy|alsaadi/i);
});

test("the document is served with a script policy that needs a nonce", async ({ page, loc }) => {
  const res = await page.goto(`/${loc}`);
  const csp = (await res?.headerValue("content-security-policy")) ?? "";
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain("nonce-");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("base-uri 'self'");
});

test("catalogue lists the seeded courses", async ({ page, loc }) => {
  await page.goto(`/${loc}/courses`);
  await expect(page.locator('a[href*="/courses/eg-12-math"]').first()).toBeVisible();
});

test("course page shows a price from the stored SKU", async ({ page, loc }) => {
  await page.goto(`/${loc}/courses/eg-12-math`);
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator("body")).toContainText(/300/);
});

test("health check answers ok", async ({ request }) => {
  expect(await (await request.get("/api/health")).json()).toEqual({ ok: true });
});

test("cron refuses a call without the secret", async ({ request }) => {
  expect((await request.get("/api/cron/reminders")).status()).toBe(401);
});

test("no horizontal scroll on the home page", async ({ page, loc }) => {
  await page.goto(`/${loc}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
