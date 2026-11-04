# Handoff log (live)

For whoever continues next (another AI or tool). Newest line at the bottom of "Done". Read `AGENTS.md`, then
`docs/WORKLOG.md`, then `docs/platform-gap-plan.md` (status table). Each line below is one finished, committed step.
Everything still open, in order: `docs/plans/remaining.md`.

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
- 2026-11-04 e2e/lessons.spec.ts: free unit open, paid unit closed until an entitlement is granted, signed out refused. GOTCHA for SQL helpers in e2e/db.ts: Prisma stores UTC in timestamp columns, so raw SQL must use (now() at time zone 'utc'), plain now() is +4h on this machine.
- 2026-11-04 full suite: 98 passed, 2 skipped (16.8 min). Pushed to main.
- 2026-11-04 CI failed on GitHub (both jobs, ~9s): Node 22 ships npm 10, which rejected package-lock.json ("Missing: @swc/helpers"); local npm 11 did not. Fixed by regenerating the lock with `npx npm@10 install --package-lock-only`. ALWAYS check lockfile changes with `npx npm@10 ci --dry-run`. Reminders workflow run #4 also showed Failure in 0s with no jobs: cause unknown (secrets not set yet?), check its log in the Actions tab.

- 2026-11-04 money tests: `src/lib/ziina.test.ts` (settlement decisions, stable event id) and `src/lib/payments.test.ts` (replay drops, no double grant, 30/70 row, failed/expired). Added the `@/*` alias to `vitest.config.ts` — without it no module importing `@/…` was unit-testable. 210 tests, tsc and build green. NOTE: `payments.test.ts` fakes the transaction, so it models the database contract rather than proving it; a real double-delivery check still wants Postgres.

- 2026-11-04 `reminders.yml` fixed: `run:` held `Authorization: Bearer …` unquoted, and a colon-space inside a plain YAML scalar is a mapping separator, so GitHub could not parse the workflow at all — that is the "run #4 failed in 0s with no jobs" cause. Moved the command into a `|` block. Verified with a YAML parser (before: ScannerError, after: parses). Owner must push and re-run the workflow by hand; secrets still need to be right.

- 2026-11-04 owner decision: hide live streaming and switch off scheduled reminders, deleting nothing. Landed so far: `User.liveApproved` (default false, additive migration `20261107120000_teacher_live_approval`), `src/lib/live.ts` gates, an admin toggle on `admin/teachers/[id]`, `vercel.json` crons emptied, `reminders.yml` schedule removed (manual dispatch only). **NOT DONE YET: nothing reads the gate, so live is still visible on the site.** Remaining surfaces: course page, checkout, `/live/[id]`, dashboard, student home, teacher live, parent pages.

- 2026-11-05 live lectures now use a teacher-hosted meeting link (Zoom / Teams / Meet) instead of the Daily iframe. `LiveSession.roomUrl` keeps its column and now holds the pasted link; `src/lib/live-rules.ts` validates https + a host allow-list; the join page keeps its ladder and ends in a consent gate + a plain external link; `liveAttendance` now means "opened the link". `GuardianConsent` (new, additive) can only be written by a linked parent, from `/parent`. `liveOffered` / `liveInstructor` / `liveApprovedOn` now gate the course page, dashboard, student home, join page, teacher form and checkout. Daily is unused but present. 217 unit tests, tsc and build green. NOT done: e2e spec for the new flow, and the owner-approved cleanup of stale `daily.co` rows.

- 2026-11-05 `e2e/live.spec.ts` added (7 tests, pass on en-desktop and ar-desktop): no consent → no link; consent → the link appears with `target=_blank` and `rel=noopener` and no iframe; a parent records consent from `/parent`; no seat → no link; cancelled → no link; an unapproved teacher gets no schedule form and an approved one does; an unapproved teacher's session is not reachable. Seed gained two sessions (one live in 2 minutes, one cancelled), a SEMESTER grant for the UAE student, a second parent link, and `teacherAe.liveApproved`. Helpers in `e2e/db.ts`: `liveOf`, `consentLive`, `clearConsent`, `setLiveApproved`. Observed, not caused by us: `Unexpected end of JSON input` printed by the Next dev server the first time `/parent` compiles; the page renders and the tests pass, and the production build is clean.

- 2026-11-05 attendance wording fixed everywhere it still claimed attendance: `office.attendees` (admin live), `parent.attendedMonth` (parent home), `homework.liveTitle` / `noLive` (parent child page) and the weekly parent digest in `/api/cron/reminders`, in Arabic and English. Copy only; the underlying `LiveAttendance` row is unchanged. 217 tests, tsc, build and `e2e/live.spec.ts` green.

- 2026-11-05 innovations roadmap saved to `docs/plans/innovations.md` (28 ideas, waves). Wave-1 item shipped: Arabic-tolerant catalogue search — `src/lib/arabic-search.ts` folds hamza forms, taa marbuta, alef maqsura, diacritics, tatweel and Arabic-Indic digits, with the article optional; `/courses` folds in memory (cap 500). 12 new unit tests, `e2e/search.spec.ts` scoped to `#results` because the header banner also links to the seeded course. 229 tests, tsc, build green.

- 2026-11-05 one-tap confidence after a finished lesson (`LessonConfidence` enum on `LessonView`, additive migration). Three buttons, one write, `aria-pressed` reflects the current answer; access re-checked in the action. This is the input for the readiness index and class pulse, neither built yet. `e2e/lessons.spec.ts` covers the tap. 229 tests, tsc, build green.

## Next (in order)
1. (done, untested on GitHub) e2e job in ci.yml: check the Actions tab after the next push; Postgres cannot run as root, the runner user is not root
2. (done) e2e checkout
3. (done) e2e lesson access. Exam and homework e2e still open (need seeded exam/assignment rows).
4. e2e: exam and homework
5. money tests (30/70 split, refund, webhook replay), load test, a11y pass, Sentry/uptime, restore drill
