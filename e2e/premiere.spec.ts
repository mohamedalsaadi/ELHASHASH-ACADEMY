// Free premiere: the page is public, the video is not. What can go wrong silently is the video (or its id) reaching
// someone who is signed out or who arrives before the start, so these tests look at the HTML, not only at the screen.
import { randomUUID } from "node:crypto";
import { test, expect, signInAs } from "./fixtures";
import { courseIdOf, freshStudent, sql } from "./db";

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
