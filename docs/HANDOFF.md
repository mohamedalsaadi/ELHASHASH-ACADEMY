# Handoff log (live)

For whoever continues next (another AI or tool). Newest line at the bottom of "Done". Read `AGENTS.md`, then
`docs/WORKLOG.md`, then `docs/platform-gap-plan.md` (status table). Each line below is one finished, committed step.

## How to work
- Run all e2e: `npm run e2e` (about 13 min). One spec: `npm run e2e -- e2e/roles.spec.ts --project=en-phone`.
- Before handing back: `npx tsc --noEmit`, `npm test`, `npm run build`.
- Never push, deploy or spend without the owner's yes. Stripe stays on test. Never use the production DATABASE_URL.
- Commit after every step (small commits), then add a line to "Done" here.

## Owner actions still open
- Set `CRON_SECRET` in Vercel (Production) and as a GitHub Actions secret; add GitHub secret `APP_URL`=`https://dhirwa.ae`.
- Set `GEMINI_API_KEY` in Vercel. Confirm `BLOB_READ_WRITE_TOKEN`.

## Done
- 2026-11-04 e2e suite on a throwaway Postgres (d2a1909), plans saved under docs/plans (f42eb34), pushed.
- 2026-11-04 added `e2e` job to .github/workflows/ci.yml (not yet run on GitHub).
- 2026-11-04 e2e/checkout.spec.ts: sign-in redirect keeps cart, priced total, unknown SKU page (passes en-desktop, ar-phone). No gateway key in e2e, so the Ziina step itself is not exercised.
- 2026-11-04 e2e/reset.spec.ts + e2e/db.ts (plain-pg helper: Playwright cannot import the generated Prisma client, it uses import.meta): reset link, single use, short password, no email enumeration. Passes en-desktop, ar-phone.

## Next (in order)
1. (done, untested on GitHub) e2e job in ci.yml: check the Actions tab after the next push; Postgres cannot run as root, the runner user is not root
2. (done) e2e checkout
3. e2e: lesson page (reset is done)
4. e2e: exam and homework
5. money tests (30/70 split, refund, webhook replay), load test, a11y pass, Sentry/uptime, restore drill
