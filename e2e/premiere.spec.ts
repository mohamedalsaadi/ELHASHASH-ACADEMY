// Free premiere: the page is public, the video is not. What can go wrong silently is the video (or its id) reaching
// someone who is signed out or who arrives before the start, so these tests look at the HTML, not only at the screen.
import { randomUUID } from "node:crypto";
import { test, expect, signInAs } from "./fixtures";
import { courseIdOf, freshStudent, sql } from "./db";
import { PERSONAS } from "./personas";

const COURSE = "ae-12-math-e2e";
const MINUTE = 60_000;

// ISO strings, not Date objects: the column has no time zone and pg would write this machine's local wall time.
/** One premiere for this test, starting `startsInMin` minutes from now (negative: already playing). */
async function premiere(tag: string, startsInMin: number, opts: { cancelled?: boolean } = {}) {
  const key = `${tag}-${test.info().project.name}-${Date.now()}`;
  const slug = `e2e-${key}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const externalId = `vdo-e2e-${randomUUID().slice(0, 8)}`;
  const videoId = randomUUID();
  const id = randomUUID();
  await sql(`INSERT INTO "VideoAsset" (id, provider, "externalId", watermark, "durationSec") VALUES ($1, 'VDOCIPHER', $2, true, 3600)`, [videoId, externalId]);
  await sql(
    `INSERT INTO "Premiere" (id, slug, "courseId", "videoId", "titleAr", "titleEn", "startsAt", replay, "cancelledAt") VALUES ($1,$2,$3,$4,'حصة مجانية','Free live stream test',$5,true,$6)`,
    [id, slug, await courseIdOf(COURSE), videoId, new Date(Date.now() + startsInMin * MINUTE).toISOString(), opts.cancelled ? new Date().toISOString() : null],
  );
  return { id, slug, externalId };
}

test("a signed-out visitor sees the invitation, a signup link and no video before or after the start", async ({ page, loc }) => {
  for (const startsInMin of [60, -10]) {
    const p = await premiere("out", startsInMin);
    await page.goto(`/${loc}/premiere/${p.slug}`);

    await expect(page.locator("h1")).toContainText(loc === "ar" ? "حصة مجانية" : "Free live stream test");
    await expect(page.locator('main a[href*="/signup"]')).toHaveCount(1);
    await expect(page.locator('main a[href*="/signup"]')).toHaveAttribute("href", new RegExp(`next=${encodeURIComponent(`/${loc}/premiere/${p.slug}`)}`));
    await expect(page.locator("iframe")).toHaveCount(0);
    expect(await page.content()).not.toContain(p.externalId);
  }
});

test("a signed-in student before the start gets a countdown and a reminder, not the video", async ({ page, loc }) => {
  const student = await freshStudent(`prem-${loc}-${test.info().project.name}`);
  const p = await premiere("before", 120);

  await signInAs(page, loc, student.phone);
  await page.goto(`/${loc}/premiere/${p.slug}`);

  await expect(page.locator('[role="timer"]')).toHaveCount(1);
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(await page.content()).not.toContain(p.externalId);

  await page.locator('main form button').click();
  // The button is replaced by the confirmation once the server action has stored the row.
  await expect(page.locator('main form button')).toHaveCount(0);
  await expect(page.locator('main [role="status"]')).toBeVisible();
  const rows = await sql(`SELECT 1 FROM "PremiereRsvp" WHERE "premiereId" = $1`, [p.id]);
  expect(rows).toHaveLength(1);
});

test("a signed-in student after the start reaches the player stage", async ({ page, loc }) => {
  const student = await freshStudent(`prem-play-${loc}-${test.info().project.name}`);
  const p = await premiere("play", -5);

  await signInAs(page, loc, student.phone);
  await page.goto(`/${loc}/premiere/${p.slug}`);

  // The throwaway environment has no VdoCipher secret, so the token fails and the page says so instead of playing.
  // Reaching that message (and no countdown, no signup link) proves the server went down the watch path.
  await expect(page.locator('[role="timer"]')).toHaveCount(0);
  await expect(page.locator('main a[href*="/signup"]')).toHaveCount(0);
  await expect(page.locator("main .aspect-video")).toBeVisible();
});

test("a cancelled premiere never offers the video or a countdown", async ({ page, loc }) => {
  const p = await premiere("cancelled", -5, { cancelled: true });
  await page.goto(`/${loc}/premiere/${p.slug}`);

  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.locator('[role="timer"]')).toHaveCount(0);
  await expect(page.locator('main a[href*="/signup"]')).toHaveCount(0);
  expect(await page.content()).not.toContain(p.externalId);
});

test("a teacher creates a live stream for their own course and never sees another teacher's", async ({ page, loc }) => {
  const others = await sql<{ id: string }>(`SELECT id FROM "Course" WHERE slug = 'ae-12-math-second'`);
  const theirs = await premiere("other", 60);
  await sql(`UPDATE "Premiere" SET "courseId" = $1 WHERE id = $2`, [others[0].id, theirs.id]);

  await signInAs(page, loc, PERSONAS.teacherAe.phone);
  await page.goto(`/${loc}/teacher/premieres`);
  await expect(page.locator(`a[href*="/premiere/${theirs.slug}"]`)).toHaveCount(0);
  const options = page.locator('select[name="courseId"] option');
  await expect(options).toHaveCount(1);
  await expect(options.first()).toHaveAttribute("value", await courseIdOf(COURSE));

  const slug = `e2e-teach-${test.info().project.name}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  await page.fill('input[name="titleAr"]', "بث المدرّس");
  await page.fill('input[name="titleEn"]', "Teacher stream");
  await page.fill('input[name="startsAt"]', "2030-01-01T20:00");
  await page.fill('input[name="slug"]', slug);
  await page.fill('input[name="externalId"]', `vdo-e2e-${randomUUID().slice(0, 8)}`);
  await page.fill('input[name="lengthMin"]', "45");
  await page.locator('form:has(input[name="slug"]) button').last().click();
  await expect(page).toHaveURL(new RegExp(`/${loc}/teacher/premieres$`));
  await expect(page.locator(`a[href*="/premiere/${slug}"]`)).toHaveCount(1);
});

test("after the stream ends, the page points to the course's next stream", async ({ page, loc }) => {
  const past = await premiere("ended", -120);
  await premiere("next", 2);
  await page.goto(`/${loc}/premiere/${past.slug}`);
  await expect(page.locator('main a[href*="/premiere/e2e-next-"]')).toHaveCount(1);
});

test("share links carry their own source tag", async ({ page, loc }) => {
  const p = await premiere("share", 60);
  await page.goto(`/${loc}/premiere/${p.slug}`);
  const wa = page.locator('main a[href^="https://wa.me/"]');
  await expect(wa).toHaveCount(1);
  expect(decodeURIComponent((await wa.getAttribute("href")) ?? "")).toContain(`/premiere/${p.slug}?src=share-wa`);
});

test("the invite button tells past viewers once", async ({ page, loc }) => {
  const student = await freshStudent(`prem-inv-${loc}-${test.info().project.name}`);
  const past = await premiere("inv-past", -120);
  await sql(`INSERT INTO "PremiereRsvp" ("userId", "premiereId") VALUES ($1, $2)`, [student.id, past.id]);
  const next = await premiere("inv-next", 600);
  const told = async () => (await sql(`SELECT 1 FROM "Notification" WHERE "dedupeKey" = $1`, [`premiere-invite:${next.id}:${student.id}`])).length;

  await signInAs(page, loc, PERSONAS.teacherAe.phone);
  await page.goto(`/${loc}/teacher/premieres`);
  const press = () => page.locator(`section:has(a[href*="/premiere/${next.slug}"]) form:has(input[name="locale"]) button`).click();
  await press();
  await expect(page).toHaveURL(/invited=\d+/);
  expect(await told()).toBe(1);

  // Other tests running in parallel add past viewers to the same course, so the second count is not 0; what must
  // hold is that this student is not told twice.
  await page.goto(`/${loc}/teacher/premieres`);
  await press();
  await expect(page).toHaveURL(/invited=\d+/);
  expect(await told()).toBe(1);
});

test("the watching-now ping is refused when signed out or before the start", async ({ page, loc }) => {
  const soon = await premiere("seen-soon", 60);
  const now = await premiere("seen-live", -5);
  expect((await page.request.post(`/api/premiere/${now.id}/seen`)).status()).toBe(401);

  const student = await freshStudent(`prem-seen-${loc}-${test.info().project.name}`);
  await signInAs(page, loc, student.phone);
  expect((await page.request.post(`/api/premiere/${soon.id}/seen`)).status()).toBe(403);
  const live = await page.request.post(`/api/premiere/${now.id}/seen`);
  expect(live.status()).toBe(200);
  expect((await live.json()).watching).toBeGreaterThanOrEqual(1);
});

test("watching live earns one 5% course discount that ends 48 hours after the stream, shown with its clock", async ({ page, loc }) => {
  const now = await premiere("reward-live", -5);
  await sql(`UPDATE "Premiere" SET "attendReward" = true WHERE id = $1`, [now.id]);
  const student = await freshStudent(`prem-rw-${loc}-${test.info().project.name}`);
  await signInAs(page, loc, student.phone);
  for (let i = 0; i < 2; i++) expect((await page.request.post(`/api/premiere/${now.id}/seen`)).status()).toBe(200);
  // endsAt read as text: the column has no time zone (see the note above `premiere`).
  const coupons = await sql<{ percentOff: number; funding: string; ends: string }>(`SELECT "percentOff", funding, "endsAt"::text AS ends FROM "Coupon" WHERE "ownerId" = $1`, [student.id]);
  expect(coupons.map(({ percentOff, funding }) => ({ percentOff, funding }))).toEqual([{ percentOff: 5, funding: "PLATFORM" }]);
  // The 60-minute stream started 5 minutes ago, so it ends in 55 minutes and the discount 48 hours after that.
  const hoursLeft = (new Date(coupons[0].ends.replace(" ", "T") + "Z").getTime() - Date.now()) / 3_600_000;
  expect(hoursLeft).toBeGreaterThan(48.8);
  expect(hoursLeft).toBeLessThan(49);

  await page.goto(`/${loc}/premiere/${now.slug}`);
  await expect(page.locator("main section.border-up [role='timer']")).toHaveCount(1);
});
