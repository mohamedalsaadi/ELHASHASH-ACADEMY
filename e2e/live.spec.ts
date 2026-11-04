// Live lectures: the teacher hosts outside the app, so the only thing that can go wrong silently is
// who sees the link. These tests cover the ladder, the guardian consent gate and the approval gate.
import { test, expect, signInAs } from "./fixtures";
import { clearConsent, consentLive, freshStudent, liveOf, setLiveApproved } from "./db";
import { PERSONAS } from "./personas";

const COURSE = "ae-12-math-e2e";
const STUDENT = PERSONAS.studentAe.phone;
const LINK = 'a[href*="meet.google.com"]';

test("a student with no guardian consent never sees the meeting link", async ({ page, loc }) => {
  await clearConsent(STUDENT);
  const { live } = await liveOf(COURSE);

  await signInAs(page, loc, STUDENT);
  await page.goto(`/${loc}/live/${live}`);

  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator(LINK)).toHaveCount(0);
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("once consent exists the join link appears, outside the page", async ({ page, loc }) => {
  await consentLive(STUDENT);
  const { live } = await liveOf(COURSE);

  await signInAs(page, loc, STUDENT);
  await page.goto(`/${loc}/live/${live}`);

  const link = page.locator(LINK);
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute("href", "https://meet.google.com/e2e-live");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(link).toHaveAttribute("target", "_blank");
  // No embedded player, and the provider is never named as daily.
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("daily.co");
});

test("a parent records consent from the parent page", async ({ page, loc }) => {
  await clearConsent(STUDENT);

  await signInAs(page, loc, PERSONAS.parent.phone);
  await page.goto(`/${loc}/parent`);

  const card = page.locator("li").filter({ has: page.locator("h2", { hasText: PERSONAS.studentAe.name }) });
  const form = card.locator('form:has(input[name="studentId"])');
  await expect(form).toHaveCount(1);

  await form.locator('button[type="submit"]').click();

  await expect(card.locator('form:has(input[name="studentId"])')).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText(/NaN|undefined/);
});

test("a student without a seat gets no link", async ({ page, loc }) => {
  const stranger = await freshStudent(`live-${loc}-${test.info().project.name}`);
  const { live } = await liveOf(COURSE);

  await signInAs(page, loc, stranger.phone);
  await page.goto(`/${loc}/live/${live}`);

  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator(LINK)).toHaveCount(0);
});

test("a cancelled lecture never shows a link", async ({ page, loc }) => {
  await consentLive(STUDENT);
  const { cancelled } = await liveOf(COURSE);

  await signInAs(page, loc, STUDENT);
  await page.goto(`/${loc}/live/${cancelled}`);

  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator(LINK)).toHaveCount(0);
});

test("an unapproved teacher cannot schedule, an approved one can", async ({ page, loc }) => {
  const teacher = PERSONAS.teacherAe;

  await setLiveApproved(teacher.phone, false);
  try {
    await signInAs(page, loc, teacher.phone);
    await page.goto(`/${loc}/teacher/live`);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator('input[name="meetingUrl"]')).toHaveCount(0);
    await expect(page.locator('select[name="courseId"]')).toHaveCount(0);
  } finally {
    await setLiveApproved(teacher.phone, true);
  }

  await page.goto(`/${loc}/teacher/live`);
  await expect(page.locator('input[name="meetingUrl"]').first()).toBeVisible();
  await expect(page.locator('select[name="courseId"]')).toHaveCount(1);
});

test("a session for an unapproved teacher is not reachable", async ({ page, loc }) => {
  await consentLive(STUDENT);
  const { live } = await liveOf(COURSE);
  const teacher = PERSONAS.teacherAe;

  await setLiveApproved(teacher.phone, false);
  try {
    await signInAs(page, loc, STUDENT);
    await page.goto(`/${loc}/live/${live}`);
    // notFound(): the page either redirects away or renders the not-found marker.
    const url = new URL(page.url());
    const refused = !url.pathname.includes(`/live/${live}`) || (await page.locator("[data-not-found]").count()) > 0;
    expect(refused).toBe(true);
    await expect(page.locator(LINK)).toHaveCount(0);
  } finally {
    await setLiveApproved(teacher.phone, true);
  }
});
