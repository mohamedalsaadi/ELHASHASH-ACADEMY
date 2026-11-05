import { test, expect } from "./fixtures";

// WCAG 2.5.8 asks for 44 by 44 CSS pixels on pointer targets. Inline links inside a sentence are
// exempt, so only controls that lay out as their own box are measured.

type Box = { tag: string; text: string; w: number; h: number; cls: string };

async function smallTargets(page: import("@playwright/test").Page): Promise<Box[]> {
  return page.evaluate(() => {
    const out: Box[] = [];
    const selector = 'a[href], button, [role="button"], input:not([type="hidden"]), select, textarea';
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      const r = el.getBoundingClientRect();
      // Zero or 1px means visually hidden until focused (the skip link), which is not a tap target yet.
      if (r.width <= 1 || r.height <= 1) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "inline" || cs.display === "contents") continue;
      // A checkbox or radio is 16px by convention; when a label wraps it, the label is the target.
      if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
        const wrapped = el.closest("label")?.getBoundingClientRect();
        if (wrapped && wrapped.height >= 44 && wrapped.width >= 44) continue;
      }
      if (cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
      if (r.height < 44 || r.width < 44) {
        out.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 48),
          w: Math.round(r.width),
          h: Math.round(r.height),
          cls: String(el.className).slice(0, 80),
        });
      }
    }
    return out;
  });
}

for (const path of ["", "/signin", "/signup"]) {
  test(`every control on ${path || "/"} is at least 44px`, async ({ page, loc }) => {
    await page.goto(`/${loc}${path}`);
    await page.waitForLoadState("networkidle");
    const small = await smallTargets(page);
    expect(small, JSON.stringify(small, null, 2)).toEqual([]);
  });
}
