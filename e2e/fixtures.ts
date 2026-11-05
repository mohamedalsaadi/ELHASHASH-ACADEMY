import { test as base, expect, type Page } from "@playwright/test";
import { PASSWORD, PERSONAS, type Persona } from "./personas";

export type Fixtures = { loc: "ar" | "en" };

export const test = base.extend<Fixtures & { signIn: (who: Persona) => Promise<void> }>({
  loc: ["ar", { option: true }],
  signIn: async ({ page, loc }, use) => {
    // `use` here is Playwright's fixture callback, not a React hook.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(async (who) => {
      await signInAs(page, loc, PERSONAS[who].phone);
    });
  },
});
export { expect };

export async function signInAs(page: Page, loc: string, login: string, password = PASSWORD) {
  await page.goto(`/${loc}/signin`);
  await page.locator('input[name="login"]').fill(login);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('form button[type="submit"], form button:not([type])').last().click();
  await page.waitForURL((u) => !u.pathname.endsWith("/signin"), { timeout: 30_000 });
}

/** True when the page was refused: the browser ended up somewhere else, or on the not-found page. */
export async function isRefused(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  // A redirect thrown under a Suspense boundary is applied by the client router, a moment after the load.
  await page.waitForURL((u) => !u.pathname.startsWith(path), { timeout: 5_000 }).catch(() => {});
  if (!new URL(page.url()).pathname.startsWith(path)) return true;
  return (await page.locator("[data-not-found]").count()) > 0;
}
