import { test, expect, signInAs } from "./fixtures";
import { sql } from "./db";
import { PRIVACY_VERSION } from "../src/lib/legal";

// Signup is the only place a student account is created without a parent in the loop, so the
// guardian-consent record must be written there or the policy is a promise nobody keeps.

type Consent = {
  source: string;
  guardianName: string;
  guardianEmail: string | null;
  parentId: string | null;
  rulesVersion: string;
  verifiedAt: string | null;
};

async function fillStudent(page: import("@playwright/test").Page, loc: string, phone: string, email: string) {
  await page.goto(`/${loc}/signup`);
  await page.fill('input[name="name"]', "E2E Signup Student");
  await page.fill('input[name="email"]', email);
  await page.fill('input[type="tel"]', phone.slice(4)); // the picker starts on +971
  await page.selectOption('select[name="gradeId"]', { index: 1 });
  await page.fill('input[name="dateOfBirth"]', "2012-01-01");
  await page.fill('input[name="password"]', "e2e-pass-1234");
  await page.check('input[name="acceptTerms"]');
  await page.fill('input[name="guardianName"]', "E2E Guardian");
  await page.fill('input[name="guardianEmail"]', "guardian-e2e@example.com");
}

test("an under-18 student gets an unverified consent record with the guardian email", async ({ page, loc }) => {
  const stamp = String(Date.now());
  const phone = `+9715${stamp.slice(-8)}`;
  await fillStudent(page, loc, phone, `signup-${stamp}@example.com`);
  await page.check('input[name="guardianConsent"]');
  const form = page.locator('form:has(input[name="guardianName"])');
  await form.locator('button:not([type]), button[type="submit"]').last().click();
  await page.waitForURL((u) => !u.pathname.endsWith("/signup"), { timeout: 30_000 });
  // Signing up lands the student on the home page.
  await expect(page).toHaveURL(new RegExp(`/${loc}/?$`));

  const rows = await sql<Consent>(
    `SELECT gc."source", gc."guardianName", gc."guardianEmail", gc."parentId", gc."rulesVersion", gc."verifiedAt"
       FROM "GuardianConsent" gc JOIN "User" u ON u.id = gc."studentId"
      WHERE u.phone = $1`,
    [phone],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].source).toBe("SIGNUP");
  expect(rows[0].guardianName).toBe("E2E Guardian");
  expect(rows[0].guardianEmail).toBe("guardian-e2e@example.com");
  expect(rows[0].parentId).toBeNull();
  // The guardian agreed to the privacy text, not the live-lecture rules.
  expect(rows[0].rulesVersion).toBe(PRIVACY_VERSION);
  // A signup declaration is not verification; the guardian still has to open the email link.
  expect(rows[0].verifiedAt).toBeNull();
  // The terms tick is recorded with the account.
  const accepted = await sql<{ termsAcceptedAt: string | null }>(`SELECT "termsAcceptedAt" FROM "User" WHERE phone = $1`, [phone]);
  expect(accepted[0].termsAcceptedAt).not.toBeNull();

  // The account is stored as +971…, and the student can still sign in with the local number they know.
  await page.context().clearCookies();
  await signInAs(page, loc, `0${phone.slice(4)}`, "e2e-pass-1234");
  await expect(page).not.toHaveURL(/signin/);
});

test("mandatory signup fields carry a red star and the phone has a country-code list", async ({ page, loc }) => {
  await page.goto(`/${loc}/signup`);
  const form = page.locator('form:has(input[name="acceptTerms"])');
  await expect(form.locator('select[aria-label] option[value="966"]')).toHaveCount(1);
  // Every required control is announced by the browser as required; the star is its visible twin.
  const required = await form.locator("[required]").count();
  await expect(form.locator('span[aria-hidden="true"].text-down')).toHaveCount(required);
});

test("the guardian fields appear only for a student under 18", async ({ page, loc }) => {
  await page.goto(`/${loc}/signup`);
  await expect(page.locator('input[name="guardianName"]')).toHaveCount(0);
  await page.fill('input[name="dateOfBirth"]', "1990-01-01");
  await expect(page.locator('input[name="guardianName"]')).toHaveCount(0);
  await page.fill('input[name="dateOfBirth"]', "2012-01-01");
  await expect(page.locator('input[name="guardianName"]')).toHaveCount(1);
});

test("the server refuses an account when the terms are not accepted", async ({ page, loc }) => {
  const stamp = String(Date.now());
  const phone = `+9717${stamp.slice(-8)}`;
  await fillStudent(page, loc, phone, `noterms-${stamp}@example.com`);
  await page.check('input[name="guardianConsent"]');
  await page.uncheck('input[name="acceptTerms"]');
  // Submit past the browser's own `required`, so the server rule is what answers.
  await page.locator('form:has(input[name="guardianName"])').evaluate((f: HTMLFormElement) => f.submit());
  await expect(page.locator("#signup-error")).toBeVisible();

  const rows = await sql<{ id: string }>(`SELECT id FROM "User" WHERE phone = $1`, [phone]);
  expect(rows).toHaveLength(0);
});

test("the server refuses a student account with no guardian consent", async ({ page, loc }) => {
  const stamp = String(Date.now());
  const phone = `+9716${stamp.slice(-8)}`;
  await fillStudent(page, loc, phone, `noguardian-${stamp}@example.com`);
  // Submit past the browser's `required` on the checkbox, so the server-side rule is what answers.
  await page.locator('form:has(input[name="guardianName"])').evaluate((f: HTMLFormElement) => f.submit());
  await expect(page.locator("#signup-error")).toBeVisible();

  const rows = await sql<{ id: string }>(`SELECT id FROM "User" WHERE phone = $1`, [phone]);
  expect(rows).toHaveLength(0);
});

test("the server refuses a student under 13", async ({ page, loc }) => {
  const stamp = String(Date.now());
  const phone = `+9716${stamp.slice(-8)}`;
  await fillStudent(page, loc, phone, `tooyoung-${stamp}@example.com`);
  await page.fill('input[name="dateOfBirth"]', "2020-01-01");
  await page.check('input[name="guardianConsent"]');
  await page.locator('form:has(input[name="guardianName"])').evaluate((f: HTMLFormElement) => f.submit());
  await expect(page.locator("#signup-error")).toBeVisible();

  const rows = await sql<{ id: string }>(`SELECT id FROM "User" WHERE phone = $1`, [phone]);
  expect(rows).toHaveLength(0);
});
