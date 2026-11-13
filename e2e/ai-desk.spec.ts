// The owner desk for the AI coworkers: the morning briefing job and its page. AI itself is off in e2e (no key),
// so the briefing runs on plain numbers.
import { readFileSync } from "node:fs";
import { test, expect, isRefused, signInAs } from "./fixtures";
import { sql } from "./db";
import { PERSONAS } from "./personas";

test("the briefing job refuses a caller without the secret, then tells the admin once a day", async ({ request }) => {
  expect((await request.get("/api/cron/briefing")).status()).toBe(401);
  const auth = { headers: { authorization: "Bearer e2e-cron" } };
  const admin = (await sql<{ id: string }>(`SELECT id FROM "User" WHERE phone = $1`, [PERSONAS.admin.phone]))[0].id;
  try {
    const first = await request.get("/api/cron/briefing", auth);
    expect(first.status()).toBe(200);
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date());
    const rows = () => sql(`SELECT id FROM "Notification" WHERE "userId" = $1 AND "dedupeKey" = $2`, [admin, `briefing:${day}:${admin}`]);
    expect((await rows()).length).toBe(1);
    const again = await (await request.get("/api/cron/briefing", auth)).json();
    expect(again.sent).toBe(0);
    expect((await rows()).length).toBe(1);
  } finally {
    await sql(`DELETE FROM "Notification" WHERE "userId" = $1 AND "dedupeKey" LIKE 'briefing:%'`, [admin]);
  }
});

test("the AI desk page shows the briefing and the usage table to the admin only", async ({ page, loc }) => {
  await signInAs(page, loc, PERSONAS.admin.phone);
  await page.goto(`/${loc}/admin/ai`);
  await expect(page.locator("h2").first()).toBeVisible();
  const words = JSON.parse(readFileSync(`messages/${loc}.json`, "utf8"));
  await expect(page.getByRole("button", { name: words.office.ai.sendNow })).toBeVisible();

  await page.context().clearCookies();
  await signInAs(page, loc, PERSONAS.studentAe.phone);
  expect(await isRefused(page, `/${loc}/admin/ai`)).toBe(true);
});

test("a ticket the support agent flagged shows its flag and reason to the admin", async ({ page, loc }) => {
  const id = `e2e-ticket-${loc}-${test.info().project.name}`;
  await sql(
    `INSERT INTO "SupportTicket" (id, name, email, topic, message, status, "aiFlag", "aiReason", "updatedAt") VALUES ($1,'E2E Asker','asker@example.test','billing','I was charged twice for the same course this month','OPEN','payment','Double charge claimed',now())`,
    [id],
  );
  try {
    const w = JSON.parse(readFileSync(`messages/${loc}.json`, "utf8")).office.support;
    await signInAs(page, loc, PERSONAS.admin.phone);
    await page.goto(`/${loc}/admin/support`);
    const card = page.locator("li", { hasText: "asker@example.test" });
    await expect(card.getByText(w.flag.payment, { exact: true })).toBeVisible();
    await expect(card.getByText("Double charge claimed")).toBeVisible();
  } finally {
    await sql(`DELETE FROM "SupportTicket" WHERE id = $1`, [id]);
  }
});
