// Signed-in pages, one persona at a time: no sideways scroll, one h1, named controls, labelled fields, 44px tap targets,
// readable text. The public pages are covered by tap-targets.spec.ts and public.spec.ts.
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import type { Persona } from "./personas";

const STUDENT = ["/dashboard", "/me", "/account", "/notifications", "/courses/ae-12-math-e2e", "/suggest"];
const TEACHER = ["/teacher", "/teacher/questions", "/teacher/earnings", "/teacher/profile", "/teacher/bank", "/teacher/live", "/teacher/coupons"];
const ADMIN = ["/admin", "/admin/courses", "/admin/catalog", "/admin/orders", "/admin/payouts", "/admin/teachers", "/admin/reviews", "/admin/support", "/admin/settings", "/admin/ai"];
const PARENT = ["/parent", "/parent/requests"];

async function inspect(page: Page) {
  return page.evaluate(() => {
    const out: { kind: string; detail: string }[] = [];
    const add = (kind: string, detail: string) => out.push({ kind, detail });
    const doc = document.documentElement;
    if (doc.scrollWidth > window.innerWidth + 1) add("h-scroll", `scrollWidth ${doc.scrollWidth} > ${window.innerWidth}`);
    const h1 = document.querySelectorAll("main h1, h1").length;
    if (h1 !== 1) add("h1", `${h1} h1 elements`);
    const visible = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 1 && r.height > 1 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0;
    };
    const name = (el: HTMLElement) =>
      (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title") || el.textContent || "").trim() ||
      (el.querySelector("img[alt]:not([alt=''])") ? "img" : "");
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("a[href], button, [role=button]"))) {
      if (!visible(el)) continue;
      if (!name(el)) add("no-name", `${el.tagName.toLowerCase()} ${String(el.className).slice(0, 60)}`);
      const cs = getComputedStyle(el);
      if (cs.display === "inline") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) add("small-target", `${Math.round(r.width)}x${Math.round(r.height)} "${(el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30)}" ${String(el.className).slice(0, 50)}`);
    }
    for (const el of Array.from(document.querySelectorAll<HTMLInputElement>("input:not([type=hidden]), select, textarea"))) {
      if (!visible(el) && el.type !== "checkbox" && el.type !== "radio") continue;
      const labelled = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.closest("label") || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`));
      if (!labelled) add("no-label", `${el.tagName.toLowerCase()}[name=${el.getAttribute("name")}] type=${el.type}`);
    }
    for (const img of Array.from(document.querySelectorAll("img"))) if (!img.hasAttribute("alt")) add("img-no-alt", (img.getAttribute("src") ?? "").slice(0, 60));
    // Contrast of text on its first opaque ancestor background.
    const parse = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
    };
    const lum = (c: { r: number; g: number; b: number }) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const bgOf = (el: Element) => {
      for (let e: Element | null = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c && c.a >= 0.95) return c;
        if (getComputedStyle(e).backgroundImage !== "none") return null;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    };
    const seen = new Set<string>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = (n.textContent ?? "").trim();
      const el = n.parentElement;
      if (!t || !el || !visible(el) || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)) continue;
      const cs = getComputedStyle(el);
      const fg = parse(cs.color);
      const bg = bgOf(el);
      if (!fg || !bg) continue;
      const a = fg.a;
      const mixed = { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) };
      const l1 = lum(mixed), l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const size = parseFloat(cs.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
      const need = large ? 3 : 4.5;
      if (ratio < need) {
        const key = `${cs.color}|${cs.backgroundColor}|${el.className}`;
        if (seen.has(key)) continue;
        seen.add(key);
        add("contrast", `${ratio.toFixed(2)}:${need} "${t.slice(0, 28)}" ${String(el.className).slice(0, 50)}`);
      }
    }
    return out;
  });
}

async function walk(page: Page, loc: string, paths: string[], who: string) {
  const problems: string[] = [];
  for (const p of paths) {
    // The dev server can abort a first visit while it compiles the route; one more try is enough.
    await page.goto(`/${loc}${p}`).catch(() => page.goto(`/${loc}${p}`));
    await page.waitForLoadState("networkidle").catch(() => {});
    // A dev-server compile race can serve an error page once; reload before judging the page.
    if (!(await page.locator("h1").count())) await page.reload().catch(() => {});
    await page.locator("h1").first().waitFor({ timeout: 10_000 }).catch(() => {});
    for (const f of await inspect(page)) problems.push(`${who} ${p} ${f.kind}: ${f.detail}`);
  }
  expect(problems, problems.join("\n")).toEqual([]);
}

const personas: [Persona, string[], string][] = [
  ["studentAe", STUDENT, "student"],
  ["teacherAe", TEACHER, "teacher"],
  ["admin", ADMIN, "admin"],
  ["parent", PARENT, "parent"],
];

for (const [who, paths, label] of personas) {
  test(`signed-in pages of the ${label} are accessible and fit the screen`, async ({ page, loc, signIn }) => {
    test.setTimeout(240_000);
    await signIn(who);
    await walk(page, loc, paths, label);
  });
}
