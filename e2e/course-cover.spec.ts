// A course cover is served through the image optimizer, so a phone gets a resized picture, not the 5 MB upload.
// The e2e database has no storage token, so the picture itself cannot load; what is checked is the markup and that
// the optimizer accepts the cover URL (a URL outside images.localPatterns is refused with "is not allowed").
import { test, expect } from "./fixtures";
import { sql } from "./db";

const SLUG = "ae-12-math-e2e";

test.describe.configure({ mode: "serial" });

test("covers render through the image optimizer with a size ladder", async ({ page, request, loc }) => {
  await sql(`UPDATE "Course" SET "coverKey" = 'covers/e2e/cover.webp', "coverType" = 'image/webp' WHERE slug = $1`, [SLUG]);
  try {
    await page.goto(`/${loc}/courses/${SLUG}`);
    const hero = page.locator('img[src*="_next%2Fimage"], img[src*="/_next/image"]').first();
    await expect(hero).toBeVisible();
    const srcset = (await hero.getAttribute("srcset")) ?? "";
    expect(srcset).toContain("%2Fapi%2Fcovers%2F");
    expect(srcset.split(",").length).toBeGreaterThan(1);
    expect(await hero.getAttribute("sizes")).toBeTruthy();

    // The optimizer must not refuse the URL itself.
    const first = srcset.split(",")[0].trim().split(" ")[0];
    const res = await request.get(first);
    expect(await res.text()).not.toContain("is not allowed");

    // The latest-courses cards on the home page use the same route.
    await page.goto(`/${loc}`);
    await expect(page.locator('a[href*="' + SLUG + '"] img[srcset*="%2Fapi%2Fcovers%2F"]').first()).toBeAttached();
  } finally {
    await sql(`UPDATE "Course" SET "coverKey" = NULL, "coverType" = NULL WHERE slug = $1`, [SLUG]);
  }
});
