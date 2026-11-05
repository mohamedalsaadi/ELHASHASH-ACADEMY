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

- 2026-11-04 owner decision: hide live streaming and switch off scheduled reminders, deleting nothing. Landed so far: `User.liveApproved` (default false, additive migration `20261107120000_teacher_live_approval`), `src/lib/live.ts` gates, an admin toggle on `admin/teachers/[id]`, `vercel.json` crons emptied, `reminders.yml` schedule removed (manual dispatch only). ~~Nothing reads the gate yet.~~ **Superseded by the 2026-11-05 entry below, which wires every surface.**

- 2026-11-05 live lectures now use a teacher-hosted meeting link (Zoom / Teams / Meet) instead of the Daily iframe. `LiveSession.roomUrl` keeps its column and now holds the pasted link; `src/lib/live-rules.ts` validates https + a host allow-list; the join page keeps its ladder and ends in a consent gate + a plain external link; `liveAttendance` now means "opened the link". `GuardianConsent` (new, additive) can only be written by a linked parent, from `/parent`. `liveOffered` / `liveInstructor` / `liveApprovedOn` now gate the course page, dashboard, student home, join page, teacher form and checkout. Daily is unused but present. 217 unit tests, tsc and build green. NOT done: e2e spec for the new flow, and the owner-approved cleanup of stale `daily.co` rows.

- 2026-11-05 `e2e/live.spec.ts` added (7 tests, pass on en-desktop and ar-desktop): no consent → no link; consent → the link appears with `target=_blank` and `rel=noopener` and no iframe; a parent records consent from `/parent`; no seat → no link; cancelled → no link; an unapproved teacher gets no schedule form and an approved one does; an unapproved teacher's session is not reachable. Seed gained two sessions (one live in 2 minutes, one cancelled), a SEMESTER grant for the UAE student, a second parent link, and `teacherAe.liveApproved`. Helpers in `e2e/db.ts`: `liveOf`, `consentLive`, `clearConsent`, `setLiveApproved`. Observed, not caused by us: `Unexpected end of JSON input` printed by the Next dev server the first time `/parent` compiles; the page renders and the tests pass, and the production build is clean.

- 2026-11-05 attendance wording fixed everywhere it still claimed attendance: `office.attendees` (admin live), `parent.attendedMonth` (parent home), `homework.liveTitle` / `noLive` (parent child page) and the weekly parent digest in `/api/cron/reminders`, in Arabic and English. Copy only; the underlying `LiveAttendance` row is unchanged. 217 tests, tsc, build and `e2e/live.spec.ts` green.

- 2026-11-05 innovations roadmap saved to `docs/plans/innovations.md` (28 ideas, waves). Wave-1 item shipped: Arabic-tolerant catalogue search — `src/lib/arabic-search.ts` folds hamza forms, taa marbuta, alef maqsura, diacritics, tatweel and Arabic-Indic digits, with the article optional; `/courses` folds in memory (cap 500). 12 new unit tests, `e2e/search.spec.ts` scoped to `#results` because the header banner also links to the seeded course. 229 tests, tsc, build green.

- 2026-11-05 one-tap confidence after a finished lesson (`LessonConfidence` enum on `LessonView`, additive migration). Three buttons, one write, `aria-pressed` reflects the current answer; access re-checked in the action. This is the input for the readiness index and class pulse, neither built yet. `e2e/lessons.spec.ts` covers the tap. 229 tests, tsc, build green.

- 2026-11-05 exam readiness index, `src/lib/readiness.ts` (pure, 10 unit tests), rendered as a card on `courses/[slug]` with `data-readiness`. Coverage 35 / accuracy 35 / confidence 15 / recency 15, renormalised over available signals; no practice caps the score at 55 by design. Gap names the weakest unit (≥3 marked attempts, <80%) else the unit with most unfinished lessons. WARNING for later: `courses/[slug]/page.tsx` has a local `opens` helper — do not import `opens` from `lib/learning` there. 239 tests, tsc, build, `e2e/lessons.spec.ts` green.

- 2026-11-05 instructor comparison block on the subject page: one card per teacher above the course list (photo/initial, name, bio, live chip, summed lesson count, open-course and profile links). One card per teacher even with several courses. Nothing about students is shown, by design. `cardInclude` now selects the instructor's photo and bios. New spec `e2e/instructors.spec.ts` (3 tests) green on ar and en; seed gained a second teacher's course on ae/12/math.

- 2026-11-05 audit items 1, 2, 3, 5, 24 done. Exams now require staff or a plan (page + startExam); parent-link code limited to 10 tries/15 min with `timingSafeEqual`; `User.passwordChangedAt` + JWT stamp ends sessions on any password change (4 write paths); CSV formula injection defused; `awardPractice` returns the attempt's XP instead of the running total, fixing the leaderboard and both "XP earned" labels. 241 tests, build, `e2e/exam-access` + `reset` + `lessons` green. Gap: no automated test yet for #2 or #3.

- 2026-11-05 audit items 6, 34, 35, 40. Nonce-based CSP in `middleware.ts` (verified strict in a production build: every script tag nonced, no violations in a browser); the intro guard moved to `public/intro-guard.js` to keep inline script banned. `Course.aiGrading` default false with an admin toggle — automatic AI grading is now opt-in and the privacy page names Google. Privacy cookies section rewritten to match the analytics that really run. `vercel.json` + `reminders.yml` schedulers re-enabled (will be red until CRON_SECRET matches). IMPORTANT: new columns exist only in migrations; deploy must run `prisma migrate`.

- 2026-11-05 reminders removed entirely at the owner's decision: cron route, workflow and vercel.json entry deleted, along with the parent weekly digest, owner briefing and analytics purge that shared the route. `EXPIRING`/`LIVE_SOON` stay in the DB enum, unused. Audit items 9, 17, 23, 33 declined.

- 2026-11-05 audit items 31, 29, 56, 46 and 55. 161 `ar ? xAr : xEn` sites now call `pick()`, with a test for the fallback; subscriber dates and live-session starts format in the course's zone; the course units, homework, teacher questions and teacher roster gained scoped search reusing `matchesQuery`; `generateMetadata` and the page share one query via `cache()`; the wordmark and short footer links reached 44px and `e2e/tap-targets.spec.ts` guards it. 256 unit tests, tsc and build green. Deleted two stale launch-checklist lines that still told the owner to schedule the removed reminders route.
- 2026-11-05 the e2e suite is green again. It was red before this work for two reasons, both reproduced on `060900b`: the live seed's whole-course grant broke the two checkout price tests (they now use `studentAe2`, seeded with no entitlement), and `oneDevice` blocked every Playwright project after the first on the live join page (`clearDevice` added).

## Where things stand (2026-11-05, end of session)

Read this first; the "Done" list above is history.

### Audit work
`docs/audit.md` holds 66 numbered items plus 10 service recommendations (G1–G10).
**57 done · 1 left and it is an environment change · 4 declined by the owner · 10 service items are the owner's.**

- **Declined by the owner, do not re-propose:** #9 (email verification enforcement), #17 (`/api`
  behind the launch gate), #23 (dependency bumps for zod/next/@vercel/blob), #33 (drop the dead
  `Concept` and `QuizAttempt` tables).
- **Removed by the owner's decision:** reminders are gone entirely — the cron route, its workflow, the
  Vercel cron, the weekly parent digest, the owner briefing and the analytics purge that shared the
  route. `EXPIRING`/`LIVE_SOON` remain in the DB enum, unused. `CRON_SECRET` is no longer read.
- **Done in the 2026-11-05 follow-up session:** #31 (161 call sites moved to `pick()`, then the nine the
  first sweep missed — operands with `!`, `?.` or method calls, and `locale === "ar"` sites — were
  converted in the review follow-up), #29 (subscriber end dates now format in the
  course's zone, live-session starts too), #56 (scoped search on the course units, teacher questions
  and teacher roster), #46 (`cache()` on `courses/[slug]` and `teachers/[id]`), #55 (home controls are
  44px; `e2e/tap-targets.spec.ts` now measures them in both locales at both widths).
- **#47 is the last one and it is not code.** `DATABASE_URL` ends in `sslmode=require`, which
  `pg-connection-string` 8.x warns about. Change it to `sslmode=verify-full` in Vercel and locally;
  behaviour is identical under `pg` 8.23. Steps are in `docs/launch-checklist.md` under Deployment.
- **#45 is wrong as written** and should not be "fixed": `/courses` reads `searchParams.q`, which
  forces dynamic rendering regardless of `revalidate`.

### Known weaknesses in what was shipped
- **#2 (parent-link rate limit) and #3 (session invalidation on password change) have no automated
  test.** Verified by reading, not by a red-then-green test.
- **The CSP was verified in a production build on `/ar/privacy` only** — a static page. DB-backed
  pages are covered by dev-mode e2e, where `unsafe-inline` is allowed, so a production-only violation
  there would not have been caught.
- **#19's rate-limiter race is documented, not removed** (`src/lib/rate-limit.ts`).
- **One commit was made while two tests were red** during this session; it was caught and fixed in the
  next commit. Keep the exit code of `npm test` visible when chaining with `| grep`.

### Deploy steps the owner still owes (blocking)
1. `prisma migrate` — five columns exist only in migrations: `LessonView.confidence`,
   `GuardianConsent`, `User.passwordChangedAt`, `Course.aiGrading`, plus the live-approval column.
2. Redeploy. The CSP, HSTS preload and Permissions-Policy only reach users on a new build.
3. `CRON_SECRET` can be removed from GitHub and Vercel; nothing reads it.
4. Confirm in Vercel Production: `GEMINI_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `APP_URL`.
5. Optional cleanups: `UPDATE "LiveSession" SET "roomUrl" = NULL WHERE "roomUrl" LIKE '%daily.co%';`
   and `DELETE FROM "Notification" WHERE kind IN ('EXPIRING','LIVE_SOON');`
6. Approve one teacher for live when that path is ready to test.

### Working rules that caught real bugs here
- Run `npx tsc --noEmit`, `npm test`, `npm run lint` and `npm run build` before every commit, and
  **read the exit code** — piping through `grep` hides failures.
- New columns mean `.env.local`'s production database will fail every query locally until the
  migration is applied. The e2e harness (throwaway DB) is the way to verify without touching
  production.
- Clear `.next` after deleting a route, or stale generated types break `tsc`.
