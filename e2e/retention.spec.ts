import { test, expect } from "./fixtures";

// The retention job is the only thing that deletes behavioural and support data, so its door has
// to stay shut to everyone but the scheduler.

test("the retention job refuses a caller without the secret and answers one with it", async ({ request }) => {
  expect((await request.get("/api/cron/retention")).status()).toBe(401);
  expect((await request.get("/api/cron/retention", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);

  const ok = await request.get("/api/cron/retention", { headers: { authorization: "Bearer e2e-cron" } });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toMatchObject({ ok: true });
});
