// A teacher uploads a lesson PDF and the lesson saves itself. Before, the pages were on no lesson until the teacher
// pressed Save, and a teacher who opened the lesson first saw "file not available" (2026-11-24).
// The e2e database has no Blob store, so the Blob token and upload endpoints are answered by the test.
import { test, expect } from "./fixtures";
import { lessonsOf, sql } from "./db";

const SLUG = "eg-12-math";

const PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]>>endobj
trailer<</Root 1 0 R/Size 4>>
%%EOF`;

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };

test("uploading a lesson PDF saves its pages to the lesson without pressing Save", async ({ page, signIn, loc }) => {
  const { paid, courseId } = await lessonsOf(SLUG);
  const before = (await sql<{ kind: string }>(`SELECT kind FROM "Lesson" WHERE id = $1`, [paid]))[0].kind;
  await sql(`UPDATE "Lesson" SET kind = 'PDF', "pdfPages" = '{}' WHERE id = $1`, [paid]);
  try {
    await page.route("**/api/blob/upload", async (route) => {
      const event = route.request().postDataJSON() as { type: string; payload: { pathname: string } };
      const payload = Buffer.from(JSON.stringify({ pathname: event.payload.pathname, validUntil: Date.now() + 60_000 })).toString("base64");
      const token = `vercel_blob_client_store123_${Buffer.from(`sig.${payload}`).toString("base64")}`;
      await route.fulfill({ json: { type: "blob.generate-client-token", clientToken: token } });
    });
    await page.route("https://vercel.com/api/blob/**", async (route) => {
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      const pathname = new URL(route.request().url()).searchParams.get("pathname") ?? "";
      const url = `https://store123.private.blob.vercel-storage.com/${pathname}`;
      await route.fulfill({ headers: CORS, json: { url, downloadUrl: url, pathname, contentType: "image/jpeg", contentDisposition: "inline", etag: "e" } });
    });

    await signIn("admin");
    await page.goto(`/${loc}/admin/courses/${courseId}`);
    const form = page.locator(`form:has(input[name="id"][value="${paid}"])`);
    await form.locator('input[type="file"][accept="application/pdf"]').setInputFiles({ name: "lesson.pdf", mimeType: "application/pdf", buffer: Buffer.from(PDF) });

    await expect
      .poll(async () => (await sql<{ n: number }>(`SELECT cardinality("pdfPages") AS n FROM "Lesson" WHERE id = $1`, [paid]))[0].n, { timeout: 45_000 })
      .toBe(1);
    const saved = (await sql<{ p: string }>(`SELECT "pdfPages"[1] AS p FROM "Lesson" WHERE id = $1`, [paid]))[0].p;
    expect(saved.startsWith(`lesson-pages/${courseId}/`)).toBe(true);
  } finally {
    await sql(`UPDATE "Lesson" SET kind = $2::"LessonKind", "pdfPages" = '{}' WHERE id = $1`, [paid, before]);
  }
});
