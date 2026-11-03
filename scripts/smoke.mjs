// Black-box smoke test of a running site: public pages answer, protected pages and secret endpoints refuse strangers.
// Usage: node scripts/smoke.mjs [baseUrl]   (default http://localhost:3000). Exit 1 on any failure.
const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");

const open = ["/ar", "/en", "/ar/courses", "/en/courses", "/ar/signin", "/ar/signup", "/ar/teach", "/ar/faq", "/ar/contact", "/ar/privacy", "/ar/terms", "/ar/refund", "/sitemap.xml", "/robots.txt", "/manifest.webmanifest", "/icon.svg", "/api/health"];
// Signed out these must not show their page: a redirect to sign-in or a 404, either as the status or, when the route
// streams behind a loading boundary (status already 200), as Next's redirect / not-found marker in the body.
const closed = ["/ar/admin", "/ar/admin/teachers", "/ar/admin/settings", "/ar/teacher", "/ar/teacher/subjects", "/ar/dashboard", "/ar/account", "/ar/parent", "/ar/orders"];
const refused = [
  ["/api/cron/reminders", "GET", 401],
  ["/api/webhooks/ziina", "POST", [200, 400, 401, 403, 500]], // trigger-only: an empty body is ignored (500 = key not set)
  ["/api/webhooks/stripe", "POST", [400, 401, 403, 404]],
];

let failed = 0;
const check = (name, ok, detail) => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};
const get = (path, init = {}) => fetch(base + path, { redirect: "manual", ...init });

for (const p of open) {
  const r = await get(p);
  check(`open   ${p}`, r.status === 200, r.status);
}
for (const p of closed) {
  const r = await get(p);
  const to = r.headers.get("location") || "";
  const body = r.status === 200 ? await r.text() : "";
  const streamed = /NEXT_REDIRECT;[^"]*signin/.test(body) || /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/.test(body);
  check(`closed ${p}`, (r.status >= 300 && r.status < 400 && /signin/.test(to)) || r.status === 404 || streamed, `${r.status} ${to}`);
}
for (const [p, method, want] of refused) {
  const r = await get(p, { method, body: method === "POST" ? "{}" : undefined });
  check(`refuse ${p}`, [].concat(want).includes(r.status), r.status);
}
// The home page must carry the intro mark and no retired brand name.
const home = await (await get("/en")).text();
check("home has the intro mark", home.includes("data-dot"));
check("no retired brand names", !/sabboura|alsaadi|aacademy|a\+ academy/i.test(home));

console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
