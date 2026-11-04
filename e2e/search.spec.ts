// Catalogue search has to survive the spellings students actually type: the article dropped,
// diacritics added, tatweel stretched, hamza written differently. The catalogue stores one form.
import { test, expect } from "./fixtures";

// Scoped to #results on purpose: the sitewide "new course" banner in the header also links to this
// course, so an unscoped selector would pass even if search returned nothing.
const COURSE = '#results a[href*="/courses/eg-12-math"]';

test("search finds the course whatever form of the word is typed", async ({ page, loc }) => {
  const typed = [
    "Mathematics", // English, as stored
    "رياضيات", // article dropped
    "الرياضيات", // exactly as stored
    "رياضيّات", // with diacritics
    "الرياضيــات", // with tatweel
  ];
  for (const q of typed) {
    await page.goto(`/${loc}/courses?q=${encodeURIComponent(q)}`);
    await expect(page.locator(COURSE).first(), `query: ${q}`).toBeVisible();
  }
});

test("a query with no match shows no course", async ({ page, loc }) => {
  await page.goto(`/${loc}/courses?q=${encodeURIComponent("ززززززز")}`);
  await expect(page.locator("#results")).toBeVisible();
  await expect(page.locator(COURSE)).toHaveCount(0);
});
