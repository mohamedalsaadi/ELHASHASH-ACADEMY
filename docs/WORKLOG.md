# Work log

Read this first if you are an agent picking up the project. Newest entry on top. Each entry says what changed,
why, where, and what is still open. Rules in `AGENTS.md` and design in `DESIGN.md` still win over anything here.
Git history has the rest (`git log --oneline`).

## Standing facts

- **Brand:** Dhirwa (ذروة, "the peak"), since 2026-11-02, when the owner reserved the trade name. Sabboura was
  dropped the same day (a Dubai "Saboura" and an existing trademark). Identity "Contour" (DESIGN.md §0,
  `docs/brand/dhirwa-dna.json`). `dhirwa.ae` is live, with its DNS on Vercel; `APP_URL`, `MAIL_FROM` and callbacks point at it.
- **Live site:** https://dhirwa.ae, public. `SITE_PASSWORD` is empty, so the pre-launch gate in
  `src/middleware.ts` is off.
- **Payments (owner decision, 2026-11-02): Ziina only.**
  - `activeGateway` in `src/lib/gateway.ts` returns Ziina for AED and nothing else. Stripe and Paymob code stays but is
    hidden until the owner allows it: `STRIPE_ENABLED=1` / `PAYMOB_ENABLED=1`. With no gateway, checkout says payment
    is not open yet and the API answers `payments_unavailable`.
  - Stripe stays on test keys (AGENTS.md).
  - Ziina (`src/lib/ziina.ts`, `/api/webhooks/ziina`) takes money only once `ZIINA_API_KEY` is set in Vercel and the
    webhook `https://<domain>/api/webhooks/ziina` is registered. Keep `ZIINA_TEST=0` in production.
  - Bank transfer is gone (see the entry below). Do not bring it back without the owner.
- **Marketplace stage, until the end of 2026:**
  - Teachers publish their own courses, sessions, prices and cover picture per country, grade and subject.
  - The old plan ideas (monthly plan, "ways to learn") are hidden, not deleted.
  - Migrations stay additive. Keep the `2027-full-release` tag (`f0bf453`).

## 2026-11-05: Production outage, cause and fix

**Symptom.** dhirwa.ae answered 200 but every page rendered the error boundary ("حدث خطأ"), and the browser
console showed a server-components render error with only a digest.

**Cause.** The deployed code was ahead of the production schema. `origin/main` (`32b8c01`) selects
`User.liveApproved` through `cardInclude` (`src/lib/catalog.ts:104`) and reads `User.passwordChangedAt` in
`auth()`; neither column existed. Six migrations were pending on Neon, the newest applied being
`20261106120000_teacher_countries`. Postgres returned `P2022 column does not exist`, the query threw, and
because the shared header reads the session, every route failed. `/api/health` still answered 200 because it
only runs `SELECT 1`, which is why this could not be seen from an uptime check.

**Fix.** `npx prisma migrate deploy` against Neon, with the owner's approval. Six additive migrations applied;
`prisma migrate status` now says the schema is up to date. Verified by rendering `/ar`, `/en` and `/ar/courses`:
real headings, zero console errors.

**Lesson.** The handoff already said "deploy must run `prisma migrate`". It was still missed, so the health
endpoint now hides a class of failure that matters more than connection loss. Consider making it check a
column the newest migration adds, or have the deploy run migrations automatically.

## 2026-11-05: Three-angle review (critic, UI, security) and its fixes

**Why.** The owner asked for three independent senior reviews of the whole platform: an adversarial critic,
a UI engineer and a security engineer. Each worked read-only and returned findings with `path:line`. The
merged plan is `~/.claude/plans/release-3-agents-one-zesty-whale.md`; this entry records what was built.

**The three that mattered most.**

1. **Password rules disagreed in six places, and sign-in validated policy, not credentials.** A teacher
   approved through `/teach` (8–11 characters) or an admin who changed their own password to 10–11 could
   never sign in again. One `PASSWORD_MIN`/`PASSWORD_MAX` now feeds every creator; sign-in only checks the
   credential. The minimum is 8, matching the copy students already read.
2. **The privacy policy was false in two places.** Support messages were documented as deleted after
   handling and analytics as purged at 180 days; neither happened, because the purge died with the
   reminders route. There is now a daily `/api/cron/retention` job (behind `CRON_SECRET`) that deletes
   behavioural events after 180 days and closed tickets after 90, and the policy states those periods.
3. **A minor's work went to Gemini with no consent record.** Automatic grading now requires a
   `GuardianConsent` row, which signup collects: a guardian's name and a checkbox, written in the same
   transaction as the account. `GuardianConsent.parentId` is nullable and rows carry a `source`.

**Also shipped.** `opensAssignment` now checks `startsAt` (the bug `hasPlan` had already fixed for exams);
malformed Basic-auth headers 401 instead of 500; unpublished covers are not served; promotion links go
through `safeNext`; `/api/checkout` and the staff password change are throttled, and the two `chpw:`
throttles actually record failures now. Signup and `/teach` no longer reveal which address has an account.
`applyPaymentOutcome` only treats the event insert's unique violation as a replay. Stripe refunds carry an
idempotency key. Exam and practice questions have accessible names; the password reveal is 44px; anchor
targets land below the sticky header; `.btn-outline` follows `DESIGN.md` §7; lesson state is spoken;
`--color-up` reaches AA on paper; map stations use the router `Link`; six copies of the field styles became
one; admin tables wrap instead of scrolling sideways. Nine `pick()` sites the first sweep missed, the dead
Daily path and the dead `masteryOf` are gone. `docs/HANDOFF.md`, `AGENTS.md`, the gap plan, `remaining.md`,
the launch checklist and the privacy processor list no longer describe Daily, a Basic-auth gate or a
reminders cron.

**Verification.** 262 unit tests, `tsc` and `npm run build` green. The full Playwright suite ran 190 passed
and 4 failed, and all four were the same case: the new consent checkbox on `/signup` (16px input, label on
one line at Arabic desktop width). The row now has a 44px height and the tap-target spec treats a wrapped
checkbox's label as its target; that spec then passed 12/12 and `e2e/signup.spec.ts` 8/8. New specs:
`e2e/signup.spec.ts` (consent recorded; no consent, no account) and `e2e/retention.spec.ts` (the job
refuses callers without the secret).

**Follow-up: the two tests the audit asked for.** `e2e/security.spec.ts` proves the parent-link code stops
after ten wrong tries (the correct code is refused too, and no `ParentLink` row is written) and that a password
reset ends a session that was already open. Both were run red with the protection removed. The session test is
only observable if the JWT re-checks the user row on every request, so `RECHECK_MS` reads
`SESSION_RECHECK_MS` (default five minutes) and the e2e harness sets it to 0. The parent-link test waits for
each server action's response; the first version used fixed sleeps and silently skipped attempts.

**Home page data cache.** The comment said a five-minute `revalidate` kept the home page fast; it did
nothing, because `SiteHeader` reads the session in the layout and that makes every route dynamic. The route
now says so plainly, and the catalogue queries are wrapped in `unstable_cache` (production only) with the
same five minutes. Measured against a throwaway database: 533 ms cold, then 44 ms and 28 ms. Making the
page itself cacheable still means moving the session out of the header, which is unchanged below.

**Deliberately not done.** Moving the unread-badge query out of `SiteHeader`. The header calls `auth()` and
a notification count in the shared layout, which is what makes every route dynamic, so the home page's
`revalidate = 300` never applies. Fixing it means a session endpoint plus a client header — a redesign of
the auth UI, not a one-file change — and it should be its own reviewed piece. Also left alone: the local
`panel` constant in `parent/page.tsx` (4px of padding drift), and the metadata ternaries that choose
between two whole sentences rather than two stored fields.

## 2026-11-05: Audit items 31, 29, 56, 46 and 55 (last five code items)

**Why.** These were the last five code items in `docs/audit.md`; #47 is left and it is an environment string.

**What changed.**
- **#31, the language fallback.** `pick(ar, arabic, english)` already existed but reached only three files. A codemod
  (`ar ? xAr : xEn` → `pick(ar, xAr, xEn)`) moved 161 call sites in 56 files. Four icon ternaries (`ar ? ArrowLeft :
  ArrowRight`) and the deliberate bilingual subtitle on `courses/c/[country]/[level]` stay as they are. `pick()` has a
  new unit test.
- **#29, subscriber dates.** `admin/subscribers` formatted every end date in `Africa/Cairo`. Access ends on a day
  boundary in the course country's zone, so a Kuwaiti student's last day could read a day early. Both pages now format
  per course zone; the detail page's live-session start does too. Account-level events (signup, last seen, orders) keep
  the office day.
- **#56, scoped search.** `matchesQuery` from `src/lib/arabic-search.ts` now powers four more boxes: the course page
  narrows its unit trail (`filterUnits`, new and tested), the course's homework list filters by assignment title, the
  teacher questions page filters by question, student or lesson, and the teacher roster filters by name, phone, course
  or lesson. New keys in `common`, `catalog`, `homework`, `teacher` and `questions`.
- **#46, dedupe.** `generateMetadata` and the page body each queried `courses/[slug]` and `teachers/[id]`. Both now share
  a React `cache()`d loader. `now` is captured inside the loader so the two callers cannot key differently.
- **#55, tap targets.** Measured live with a new `e2e/tap-targets.spec.ts` rather than trusting the 2026-11-01 count.
  Three remained: the wordmark link (37px tall), short footer links (26px wide) and the visually-hidden skip link, which
  is exempt by design. The first two are fixed. The spec runs in both locales at phone and desktop width.

**The e2e suite was red before this work, and is green after it.** Two causes, both reproduced on `060900b`:
the 2026-11-05 live seed gives `studentAe` a whole-course grant, so the two checkout tests that expect a 400 price
found nothing; they now sign in as a new `studentAe2`, seeded with the same grade and no entitlement. And `oneDevice`
binds an account to one browser fingerprint, so every Playwright project after the first was blocked on the live join
page; the live spec now releases the account's device first (`clearDevice`).

**Open.** #47: set `sslmode=verify-full` in `DATABASE_URL` (Vercel and `.env.local`). That silences the
`pg-connection-string` 8.x warning; behaviour is unchanged under `pg` 8.23. Steps are in `docs/launch-checklist.md`.

## 2026-11-05: Reminders removed from the system

Owner decision, taken deliberately after the earlier "switch it off" step was reversed: remove it
rather than keep it dormant.

- Deleted `src/app/api/cron/reminders/route.ts`, `.github/workflows/reminders.yml`, the
  `vercel.json` cron entry, and the two assertions that expected the route to answer 401
  (`e2e/public.spec.ts`, `scripts/smoke.mjs`).
- **This also ends the weekly parent digest, the owner's morning briefing and the 180-day analytics
  purge**, because all three lived in the same route. Nothing calls them now.
- The `EXPIRING` and `LIVE_SOON` values remain in the `NotificationKind` enum in the database. The
  code no longer writes them, but shrinking a Postgres enum means recreating the type on a live
  table — not worth the risk for two unused labels. Existing rows with those kinds are harmless.
- The owner can clear them whenever they choose:
  `DELETE FROM "Notification" WHERE kind IN ('EXPIRING','LIVE_SOON');`
- Also recorded: audit items **9, 17, 23 and 33 are declined** at the owner's decision.
- Verified: 250 unit tests, `npx tsc --noEmit`, `npm run lint` (0 errors), `npm run build`.

## 2026-11-05: Audit items 6, 34, 35, 40 — CSP, AI disclosure, honest privacy copy, schedulers on

- **#6 A script policy that actually blocks.** `src/middleware.ts` now issues a per-document nonce and
  sets `default-src 'self'`, `script-src 'self' 'nonce-…'`, `object-src 'none'`, `base-uri 'self'`,
  `form-action 'self'`, `frame-ancestors 'none'`, plus the three player origins in `frame-src`. The
  nonce goes on the request too, because that is how Next stamps its own streamed inline scripts.
  `'unsafe-inline'`/`'unsafe-eval'` and websockets are dev-only. The one hand-written inline script
  (the intro guard) moved to `public/intro-guard.js` so nothing needs an inline exception; `'strict-dynamic'`
  is deliberately avoided because it would block that non-nonced file. Verified in **production mode**:
  header strict, all 30 script tags nonced, a real browser loaded `/ar/privacy` with zero CSP
  violations. `e2e/public.spec.ts` asserts the header and the guard file.
- **#34 Automatic AI grading is opt-in per course.** New `Course.aiGrading` (additive migration,
  default false) with a toggle in the admin course form; the submit action only queues a suggestion
  when the course opted in. The privacy policy now names Google (Gemini) as a processor and says what
  is sent, in Arabic and English.
- **#35 The privacy policy now describes the analytics that exist.** The cookies section claimed
  "strictly necessary only, no analytics" while `AnalyticsEvent` rows are written per account and per
  device id. Rewritten in both languages: first-party events in our own database, no third-party
  tracker, no sale of data, consent banner promised if an external tracker is ever added.
- **#40 The scheduled jobs are on again.** `vercel.json` runs the daily 05:00 cron and
  `reminders.yml` runs every ten minutes. **This will go red until `CRON_SECRET` matches between
  GitHub and Vercel** — that failure is the signal, not a regression.
- Verified: 248 unit tests, `npx tsc --noEmit`, `npm run build`, `e2e/public.spec.ts` 7/7 (ar).
  Deploy note: three new columns (`Course.aiGrading` and the earlier two) exist only in migrations —
  a deployment that skips `prisma migrate` will fail every course query.

## 2026-11-05: First five audit fixes (items 1, 2, 3, 5, 24)

Chosen from `docs/audit.md`: the four S1/S2 items that were small, plus the leaderboard bug.

- **#1 Exams no longer open for free.** `courses/[slug]/exams/[examId]/page.tsx` and `startExam`
  require the course's staff, a **running** plan, or an attempt the student already owns. First cut
  used `hasPlan`, which ignored `startsAt`, so a plan bought for next term would have opened a paper
  early; `hasPlan` now checks the start too (it was documented as "what homework needs" but nothing
  called it). A student whose plan has ended keeps sight of a result they already sat, and may resume
  an attempt they legitimately started. Covered by `e2e/exam-access.spec.ts` — four cases: no plan,
  future plan, expired plan with a sat paper, running plan — plus `assignments.test.ts` for the rule.
- **#2 The parent-link code is no longer brute-forceable.** `linkChild` now allows ten tries per
  parent per 15 minutes and counts every failure, including an unknown phone, and compares the stored
  hash with `timingSafeEqual`. Six digits is a million-wide space; the window is what closes it.
  No automated test yet — an e2e needs eleven UI submissions, noted as a follow-up.
- **#3 A password reset now ends existing sessions.** New `User.passwordChangedAt` (additive
  migration), stamped by all four existing-user password writes (self change, admin change, admin
  reset, token reset). The JWT carries the value from sign-in and the 5-minute database re-check
  refuses a token whose stamp no longer matches. Worst case an old session survives five minutes
  instead of seven days.
- **#5 CSV exports can no longer carry a formula.** `csvCell` prefixes values starting with
  `= + - @` or a control character with an apostrophe. Covered by two new cases in `csv.test.ts`.
- **#24 The leaderboard no longer double-counts XP.** `awardPractice` returned the running total
  (`saved.xp`) and both callers stored it on the attempt while the leaderboard sums attempts; five
  5-XP runs counted as 75. It now returns the XP earned by that attempt. This also fixes the "XP
  earned" label on both result screens (#25).
- Verified: 241 unit tests, `npx tsc --noEmit`, `npm run build`, and e2e `exam-access`,
  `reset`, `lessons` all green on ar-desktop.

## 2026-11-05: Instructor comparison block on the subject page

- When several teachers publish a course for the same grade and subject, the catalogue used to list
  their courses flat with no way to see who is who. The subject page now opens with one card per
  teacher, above the course list, and the card leads into that teacher's course.
- `src/components/teachers/InstructorCard.tsx` and `InstructorBlock.tsx`: photo (or the initial in a
  circle), name, bio clamped to three lines with a cross-language fallback, a live chip when
  `liveApproved`, the summed lesson count, "open the course" and a link to the existing
  `/teachers/[id]` page. One card per **teacher**, not per course: a teacher with two courses for the
  subject gets one card and their lessons are summed.
- **Shows nothing about students.** No counts, no averages, no outcomes — those are minors' data and
  comparing teachers on work they set would mislead. There is no rating or review data anywhere in
  the schema, which is why none appears.
- Renders for a single teacher too, so the layout never changes shape. No migration was needed:
  `Course` has only an index on `(gradeId, subjectId)`, so two published courses can already share
  them.
- `cardInclude` in `src/lib/catalog.ts` now also selects `instructor.photoUrl/bioAr/bioEn/liveApproved`;
  every existing caller ignores the extra fields.
- Verified: `e2e/instructors.spec.ts` (two teachers, one teacher, profile link) green on ar-desktop
  and en-desktop; 239 unit tests, `npx tsc --noEmit`, `npm run build`.

## 2026-11-05: Exam readiness index on the course page

- Wave-1 item #1. `src/lib/readiness.ts` is pure and unit-tested (10 tests): coverage of openable
  lessons (35), practice accuracy from `PracticeAttempt.marks/maxMarks` (35), the one-tap confidence
  share (15) and recency decayed over 14 days (15), with the weights renormalised over the signals a
  student has actually produced.
- **Honesty rules baked into the maths:** no practice means the score is capped at 55 — watching is
  not readiness — and the card says exactly that. A unit is only named as the gap when it has at
  least three marked attempts and sits under 80%; otherwise the gap is the unit with the most
  unfinished lessons. Nothing predicts a grade the teacher has not given.
- Rendered as one card under the progress bar on `courses/[slug]`, carrying `data-readiness` for the
  tests. Readiness is only computed for a signed-in non-staff student.
- Caught while wiring: the page already declares a **local** `opens` helper, so importing the
  `opens` of the same name from `lib/learning` shadowed it and used it before its declaration — a
  temporal-dead-zone crash. The import was dropped and the local helper reused.
- Verified: 239 unit tests, `npx tsc --noEmit`, `npm run build`, and `e2e/lessons.spec.ts` (4 tests,
  ar-desktop) asserting the score is an integer in range and stays capped without practice.

## 2026-11-05: One-tap confidence after each lesson

- Wave-1 item #2. `LessonConfidence` enum (`GOT_IT | SHAKY | LOST`), nullable on `LessonView`
  (migration `20261105140000_lesson_confidence`). Null means "not answered", never "lost", so
  existing rows keep their meaning.
- After a lesson is completed, three small buttons appear under it; one tap stores the answer and
  the current one shows pressed (`aria-pressed`). No text box, no reminder, no streak pressure, and
  the answer is overwritten rather than kept as history — it is the student's current feeling.
- Access is re-checked in the action (`hasLessonAccess`), the same guard `markLessonComplete` uses,
  so a lesson cannot be rated by someone who cannot open it.
- This is the keystone for the readiness index (#1) and the teacher's class pulse (#11), both of
  which read this column.
- Verified: 229 unit tests, `npx tsc --noEmit`, `npm run build`, and
  `e2e/lessons.spec.ts` (3 tests, ar-desktop) including the new tap-then-pressed check.

## 2026-11-05: Innovations roadmap, and Arabic-tolerant catalogue search

- `docs/plans/innovations.md`: 28 ideas across student, teacher, parent, owner and platform, each
  chosen because the data already exists. Owner rules applied throughout: algorithm-first, AI drafts
  only, no leaderboards or invented social proof, nothing exposing a minor's data to another minor.
- Shipped wave-1 item: **Arabic-tolerant search** (`src/lib/arabic-search.ts`). Postgres `contains`
  could not see through أ/إ/آ/ا, ة/ه, ى/ي, diacritics, tatweel or Arabic-Indic digits, so real
  Arabic queries missed. `normalizeSearch` folds both sides; `matchesQuery` requires every token and
  also matches when one side carries "ال" and the other does not. `/courses` now loads published
  courses and folds in memory (capped at 500 — see the `ponytail:` note).
- `e2e/search.spec.ts` covers five spellings including diacritics and tatweel, plus a no-match case.
  Its selector is scoped to `#results` because the sitewide "new course" banner also links to that
  course and would have made the test pass with search broken.
- Bugs found while inventorying, not yet fixed (recorded in the roadmap): `PracticeAttempt.xp` stores
  the cumulative total rather than the run's XP, so the weekly leaderboard re-counts prior XP;
  `LessonView.watchedSec` is read by admin but never written; exam marks never reach the homework
  average or the review schedule; `masteryOf` and `QuizAttempt` have no callers.
- Verified: 229 unit tests (12 new), `npx tsc --noEmit`, `npm run build`, `e2e/search.spec.ts` green
  on ar-desktop and en-desktop.

## 2026-11-05: Live lectures by external meeting link, with guardian consent

- Owner decision: no integrated video vendor. The teacher hosts on Zoom / Teams / Google Meet and
  pastes the link per session. The app decides who sees it and when; the video is someone else's
  product. Recording was declined, so nothing is stored from a session.
- `LiveSession.roomUrl` keeps its column and now carries the teacher's link. `scheduleLive` and
  `updateLive` validate it through `src/lib/live-rules.ts`: https only, host allow-list
  (`zoom.us`, `teams.microsoft.com`, `teams.live.com`, `meet.google.com`). A bad host redirects to
  `?error=link`. `closeRoom`/`deleteRoom` are no longer called anywhere.
- Join page: the Daily iframe is gone. The ladder (cancelled → ended → signed-out → no seat →
  consent → countdown → no link → one device) ends in an external link with `noopener`. The
  attendance row is still written on load and now means "opened the link", not "attended".
- `GuardianConsent` (additive migration `20261105120000_guardian_consent`): one row per student,
  written only by a linked parent from `/parent`, never overwritten, stamped with `rulesVersion`.
  Every `STUDENT` account is treated as under 18 because no birth date is collected anywhere. This
  closes a gap where `privacy/page.tsx:158` already claimed guardian consent was required.
- `liveApproved` is finally wired: `liveInstructor` / `liveOffered` / `liveApprovedOn` gate the
  course page, dashboard, student home, join page, cron reminders and checkout. `canPublishLive`
  gates `scheduleLive`, `updateLive` and `setSeatPrice`. Default false, so live is hidden until an
  admin approves a teacher.
- Daily is dead but present: `src/lib/daily.ts` is unreferenced, and the CSP still allows it.
- Verified: 217 unit tests (7 new in `live-rules.test.ts`), `npx tsc --noEmit`, `npm run build`.
- `e2e/live.spec.ts`: 7 tests, green on `en-desktop` and `ar-desktop`. They cover the consent gate, the
  join link (href, `target=_blank`, `rel=noopener`, no iframe), the parent recording consent, a
  student with no seat, a cancelled lecture, and both sides of the teacher approval gate.
- Attendance wording now matches what is actually recorded: `office.attendees`,
  `parent.attendedMonth`, `homework.liveTitle` / `homework.noLive` and the weekly parent digest all
  say "opened the link" in English, and "رابط حصة مباشرة" / "روابط … فُتحت" in Arabic. No English
  string claims attendance any more; the remaining Arabic matches are "محاضرة", not a claim.
- Open: stale `daily.co` URLs in `LiveSession.roomUrl` need a
  one-off owner-approved cleanup; attendance copy in parent/admin still says "attended".

## 2026-11-04: Live streaming hidden, scheduled reminders switched off

- Owner decision: hide live streaming for now, keep recorded lessons, and re-enable live per teacher
  once an admin approves them. Nothing was deleted; the model, routes and pages all stay.
- `User.liveApproved` (`Boolean @default(false)`) with an additive migration. Because the default is
  false, shipping it hides live for every existing teacher without touching their data.
- `src/lib/live.ts`: `liveApprovedFor(instructorId)` for single lookups and `liveApprovedOn(course)`
  for pages that can read it through the relation.
- Admin toggle on `admin/teachers/[id]` (`setTeacherLive` in `admin/actions.ts`), with Arabic and
  English copy. Admin can turn one teacher on and off again.
- Scheduled reminders off: `vercel.json` crons emptied and `reminders.yml` lost its `schedule:`, so
  nothing calls `/api/cron/reminders` on its own. The route and the workflow file are kept; a manual
  dispatch still works once `CRON_SECRET` matches Vercel. Owner is handling the 401 separately.
- **Still open:** the gate is not wired into the UI yet, so live remains visible. Surfaces to gate:
  course page, checkout, `/live/[id]`, dashboard, student home, teacher live, parent pages.

## 2026-11-04: Reminders workflow could not be parsed at all

- `.github/workflows/reminders.yml` held its curl command inline after `run:`, and that command contains
  `Authorization: Bearer …`. A colon followed by a space inside a plain YAML scalar marks a mapping, so the
  file was invalid and GitHub created no jobs — this is why run #4 showed "Failure in 0s". Moved the command
  into a `|` block scalar. The only such occurrence in `.github/`; `ci.yml` is unaffected.
- Checked with a YAML parser: the committed version raises `ScannerError: mapping values are not allowed
  here`, the fixed one parses to one step. Still needs the owner's push and a manual re-run.

## 2026-11-04: Money tests — settlement, replay and the double-grant guard

- `src/lib/ziina.test.ts` (9 tests) drives `syncPaymentIntent` with a stubbed `fetch`, so the real
  decide-from-Ziina's-answer path runs: settles only a `completed` intent whose amount equals
  `total + vat` and whose currency matches; a short, long or foreign-currency amount sets `mismatch`
  and writes nothing; `failed` → failed, `canceled` → expired, an open intent records nothing; an
  order with no intent makes no outbound call. One test pins the event id (`ziina:<id>:<status>`) as
  identical across three deliveries — that id is what makes a replay a no-op downstream.
- `src/lib/payments.test.ts` (8 tests) drives `applyPaymentOutcome` against a fake transaction that
  models the two database guarantees it leans on: unique `gatewayEventId`, and a PAID transition
  that only counts when the order was not already PAID. Covers: one payment grants one entitlement
  and one 30/70 ledger row (9000 / 21000 on a 30000 net, VAT off); a replay returns `false` and
  grants nothing; a fresh event id on an already-paid order still grants nothing; a mismatched
  amount throws and leaves the order PENDING; failed and canceled grant nothing; a parent's payment
  grants the child. This is the first unit test in the repo to touch `payments.ts`, which the
  codebase had kept out of unit tests on purpose — the fake models the contract, it does not prove
  the database enforces it. The end-to-end proof still needs a real Postgres.
- `vitest.config.ts`: added the `@/*` → `src/*` alias. Without it no module importing `@/…` could be
  unit tested at all, which is why every earlier test covered only alias-free helpers.
- Not covered yet: refund reversal on the ledger end to end, and the webhook route's own guards
  (`not_configured`, `too_large`, unknown id) — cheap to add next.
- Verified: `npx tsc --noEmit` clean, `npm test` 210 passed (28 files), `npm run build` green.

## 2026-11-04: Phase 2 started, end-to-end suite on a throwaway database

- `npm run e2e` (`scripts/e2e.mjs`): starts a local Postgres 18 (`embedded-postgres`, UTF-8) in a temp folder,
  applies every migration, runs `prisma/seed.ts` and `e2e/seed.ts`, runs Playwright against `next dev` on port 3200,
  then deletes the database. It never reads the production `DATABASE_URL`, and blanks every service key (mail, Daily,
  Gemini, Ziina, Stripe, Blob), so nothing leaves the machine. `e2e/seed.ts` refuses any other database.
- Personas (`e2e/personas.ts`, password `e2e-pass-1234`, test database only): admin, a teacher in Egypt and one in the
  UAE, a student in each country, a parent linked to the Egypt student.
- `playwright.config.ts`: the installed Chrome (no browser download), four projects: ar and en, desktop and Pixel 7.
- Specs: public pages (lang/dir, intro mark, no retired names, no sideways scroll, catalogue, price, health, cron
  401); role boundaries (every role against admin, teacher and parent areas, signed out, wrong password); student home
  scoped to its country; parent sees the linked child; `/teach` application, refused sign-in while pending, admin
  approval, then sign-in (desktop only: 3 applications an hour per address).
- Result: 66 passed, 2 skipped (the phone runs of `/teach`), about 13 minutes.
- `vitest.config.ts` excludes `e2e/`; the not-found page carries `data-not-found` for the tests.
- Finding, not changed: the sitewide "New" bar (`NewsBanner`, in the shared layout) shows the newest courses of every
  country, so an Egypt student sees UAE courses there. Scoping it per country would make the layout dynamic; owner call.
- Added later the same day: checkout (`checkout.spec.ts`), password reset (`reset.spec.ts`), lesson access
  (`lessons.spec.ts`), helpers in `e2e/db.ts`, and an `e2e` job in `.github/workflows/ci.yml` (not yet seen green on
  GitHub). Live step-by-step state for the next agent: `docs/HANDOFF.md`.
- Open in Phase 2: exam and homework e2e, payment and refund tests, load test, accessibility pass, Sentry and uptime, restore drill, and the
  e2e job in GitHub Actions.

## 2026-11-03: Gap audit, session re-check, health check, smoke test, CI

- `docs/platform-gap-plan.md`: what is missing and the six-phase order (switch on keys, full testing, live sessions,
  lesson embeds, AI employees, product gaps).
- **Stale sessions closed:** `src/auth.ts` now re-checks the account against the database at most every 5 minutes; a
  deleted account loses its session, a demoted one its role. (Staff pages already read the role on every call.)
- `/api/health` (app plus database) for uptime checks; `scripts/smoke.mjs <url>` is a black-box check of public pages,
  protected pages and secret endpoints (all pass locally; on the live site only /api/health fails until deployed).
- `.github/workflows/ci.yml` (types, tests, build on every push) and `reminders.yml` (calls the reminder cron every 10
  minutes; needs repo secrets `APP_URL` and `CRON_SECRET`).
- Knowledge graph built with graphify into `graphify-out/` (git-ignored): 1,483 nodes, 80 communities. Rebuild with
  `python -m graphify update .`. The auto-rebuild commit hook was not installed (blocked); owner can allow it.
- Still the owner's: `CRON_SECRET`, `GEMINI_API_KEY`, Blob token in Vercel; GitHub secrets above. Not deployed.

## 2026-11-03: New minimalist intro, "Hop"

- The owner rejected the 3D logo intro (not minimal, not the logo, poor motion) and asked for two Apple/Pixar options.
- **Hop**: `src/components/three/hop-scene.ts`, flat SVG, the mark exactly as in the header. The ridges
  draw out from the peak; the gold point hops in, lands on the outer ridge, the ridges spring it up to its place.
  Test: `hop-scene.test.ts` (ends on the exact mark; hops from the start side in both directions).
- A second option, B "Light" (the mark in relief revealed by a raking 3D light), was shown; the owner chose A, so
  B and `summit-scene.ts` were deleted. The home hero no longer loads three.js.
- The hero copy padding now switches at `lg`, so below lg the mark sits in the band above the copy.

## 2026-11-03: Teachers by country, teacher self-registration, country-first student ride

- **Why:** the owner asked that teachers choose their country and create subjects (another country needs approval),
  that teachers register themselves with the owner only approving, and that the student ride ask the country first.
- **Data (additive migration `20261106120000_teacher_countries`, not yet applied to production):** `TeacherCountry` (a
  stored country grant, back-filled from existing `TeacherSlot` rows), `TeacherCountryRequest`, `TeacherApplication`,
  `TeacherApplicationCountry`, enum `ApprovalStatus`. `teacherCountryIds` now unions grants and slot-derived countries.
- **Teacher:** new `/teacher/subjects` page: country first, the country's grades and subjects, add a subject (instant,
  slug from the English name, existing subject of the same name is reused, grades added without the delete-all of
  `setGradeSubjects`), and request another country (sees its subjects first, owner is notified).
- **Self-registration:** public `/teach` (linked from sign-up). Creates only a `TeacherApplication`; the owner approves
  or rejects on `/admin/teachers`; approval creates the INSTRUCTOR account and country grants in one transaction and
  emails the applicant. Invites still work.
- **Student ride:** `/me` asks the country first (cookie `ride_country`, one year, "Change country" link), shows only
  that country's grades and subjects, caps the ride at 8 cars, fixes the lede count, recomputes the phone layout on
  rotation, and softens back cars. Pure helper `resolveCountry` is tested.
- **Deploy order:** apply the migration to the production database first, then deploy; the new code reads the new tables.

## 2026-11-03: The intro is the brand logo, drawn in 3D

- **Why:** the owner wanted the intro to be the logo itself: the ridge lines drawn exactly like the brand, then the
  yellow sphere comes out on top, Pixar-minimal. It replaces the solid mountain and the flag.
- **What:** `summit-scene.ts` builds the three ridges from `RIDGES` in `brand-svg.ts` (the same paths as `Mark.tsx` and
  every icon) as round, softly lit tubes, draws them outer to inner, then the gold sphere is born at the outer peak,
  stretches up to the mark's summit point and settles with a small squash. Colours come from tokens (`contour-6`,
  `summit`); timings, framing, skip, reduced motion and pausing are unchanged.

## 2026-11-03: Summit intro redrawn as a sculpted mountain with a flag

- **Why:** the owner found the line-only version unclear ("not the mountain, not the animation to the top") and asked
  for a minimalist Pixar/Apple-style mountain with a flag on top.
- **What:** `summit-scene.ts` now builds a solid, lit mountain (polar height grid, vertex colours from rock to a crisp
  snow cap) on a round plinth. It grows out of the map, a glowing climber walks a gold switchback trail to the top,
  the pole is planted and a gold flag unfurls and keeps waving. Colours still come from tokens (`contour-1/2/3/6`,
  `summit`, `night-2`); timings, framing, skip, reduced motion and pausing are unchanged.

## 2026-11-03: Minimal Contour intro (owner chose A over B)

- **Why:** the owner kept option A (Contour) and asked for a minimalist version that works on laptop and phone.
- **What:** `summit-scene.ts` now draws eight thin snow lines (six on a phone) with only the top one gold, a fine gold
  trail in one gentle curve and a single gold summit point; the flag and colour ramp are gone. The peak is taller.
  Framing measures the free space beside `.as-hero-copy`, so the mountain sits beside the text on a laptop and above
  it on a phone. `brand.css` quiets the still contour field behind the hero (`.stage:has(> canvas)`).
- **Removed:** option B (`dawn-scene.ts`) and the `?intro=dawn` switch. Kept: any `?intro=` link replays the intro.

## 2026-11-03: Intro option B "Dawn Relief" for the owner to compare; email sender fix

- **Why:** the owner asked for a second, comparable intro and mountain that looks right on laptop and phone.
- **What:** `src/components/three/dawn-scene.ts`: a lit relief mountain with shader contour lines, a gold ridge
  route and one summit pulse, on the same 4 s timeline. It frames itself into the free space beside the hero copy.
  `Summit.tsx` shows it only for `?intro=dawn`; the default is still option A. `Intro.tsx` replays the intro for any
  `?intro=` link. DESIGN.md §6 and `dhirwa-dna.json` describe it as under review.
- **Open:** the owner picks A or B; then delete the loser, the `?intro` switch and the replay rule.
- **Email:** `src/lib/mail.ts` now cleans `MAIL_FROM` and falls back to `Dhirwa <no-reply@dhirwa.ae>` (the stored
  value made Resend reject every send with "Invalid from field"). The reset form allows 5 requests per email per
  hour and then stays silent, which hides failures during testing. Production has `RESEND_API_KEY`, `MAIL_FROM`,
  `ZIINA_API_KEY` and `APP_URL=https://dhirwa.ae`; `SITE_PASSWORD` was removed, so the site is public.

## 2026-11-02: Rebrand to Dhirwa, identity "Contour" (uncommitted on `redesign-aurora`)

- **Why:** the owner reserved the trade name Dhirwa and asked for a full redesign with a new intro (design-dna,
  genjutsu bunshin standard, three.js).
- **Identity:** survey-paper pages, a night-map `.stage`, contour lines (`contour-1..6`) as the one ornament, one
  summit-gold point (`summit`), trail-green primary `#1F7356`, Reem Kufi for the name ذروة only. Mark = three ridge
  lines plus a gold dot (`src/app/brand-svg.ts`, `Mark.tsx`, `icon.svg`, OG images, manifest).
- **Intro:** `src/components/three/Summit.tsx` + `summit-scene.ts` replace the Board (4.0 s: contour rings lift into a
  peak, a gold trail climbs, a flag lands; copy at 3.2 s, guard clears at 4.4 s). The student-home `Ride` is now a
  trail with waypoints.
- **Pages:** home redesigned as a "climb"; catalogue trail map; auth side panel (`signin/AuthShell.tsx`); every other
  page re-skinned through tokens. Strings in `messages/*.json`.
- **Review round 1 fixed:** gold focus ring on the map; the course header buy button always reaches a plans section;
  ink check on Bahrain's colour; the intro clock starts at page load; list markup; promo `h3`; homework tile grid;
  `--text-lede` token; dead CSS.
- **Open:** the share images are English only (Satori needs an Arabic font file to shape ذروة); Paymob's fallback
  billing email is now `SUPPORT_EMAIL` → `MAIL_FROM` → `no-reply@example.com` (Paymob is off). Nothing committed,
  pushed or deployed.

## 2026-11-02: Rebrand to Sabboura, identity "Chalkboard"

- **Why:** the owner registered the trade licence as Sabboura (سبّورة, the classroom blackboard) and asked for the
  whole site, intro included, to follow the name.
- **Direction:** `docs/brand/sabboura-dna.json` (design-dna profile from a described style) and DESIGN.md §0-§1.
  Slate board for the heroes, exercise-book paper for pages, coloured chalk as the one ornament, board-green actions,
  Ruqʿah (Aref Ruqaa, `--font-hand`) for the Arabic wordmark and chalked words only. Token names are unchanged
  (`aurora-*` became `chalk-*`, `planet-*` became `wood`), so app pages re-skin without edits.
- **Mark:** a slate board on a wooden ledge with a stick of yellow chalk, one chalk stroke writing س
  (`src/app/brand-svg.ts`, `Mark.tsx`, `icon.svg`). Generated icons and share images use the same geometry on paper.
- **Intro:** the planet is gone (`Planet.tsx`, `planet-scene.ts`, `land.ts` deleted). `src/components/three/Board.tsx`
  + `board-scene.ts`: chalk draws axes and a parabola, a wave, a benzene ring, then writes سبّورة / Sabboura and
  underlines it, shedding dust; idle motes drift in three depth layers with pointer parallax. Same 4.2 s contract,
  guard and skip as before; reduced motion gets the finished board. Diagrams are not mirrored in Arabic.
- **Copy:** every "A+ Academy" became سبّورة (Arabic) or Sabboura (English); legal lines read "سبّورة (Sabboura)".
  New home headline ("مدرّسك على السبّورة، أينما كنت." / "Your teacher at the board, wherever you are."), closing
  title and footer tagline. Emails, AI support prompt, Basic-auth realm, manifest, service-worker cache (old caches
  are now deleted on activate), package name.
- **Checked:** browser pane, ar and en, desktop and phone; home intro, courses page, footer, OG image, PWA icon.
- **Open:** buy the domains and handles; licence number and address in the legal pages; the student home (`/me`)
  was not viewed signed in as a student (its colours come from the same tokens). `docs/brand/brand-book.html` and
  `aurora-dna.json` are kept as history.

## 2026-11-02: Student home ("your grade") with the subject ride

- **Routing:** with a session cookie, `src/middleware.ts` rewrites `/{locale}` to `/{locale}/me`, and the address stays `/`.
  The public home keeps its 5-minute cache. `/me` checks `auth()`: a STUDENT gets the grade page; anyone else (parent,
  teacher, admin, stale cookie) gets the public home component; a student without a grade gets a grade picker.
- **Page** (`src/app/[locale]/me/page.tsx`, data in `src/lib/student-home-server.ts`, shaping in `student-home.ts`
  with tests):
  - Hero: "Your {grade}, {country}" with the flag, and the ride.
  - Continue learning: the student's own courses.
  - Bundle offer: the real `BundleRule`s run through `price()` on the cheapest plan of each subject not owned yet,
    linking to checkout with those SKUs.
  - A row per subject with courses: subjects to buy first, then owned ones, with a "Yours" chip.
  - One "Coming soon" line naming the empty subjects.
  - Live sessions in the next 7 days, then a "change grade" link.
- **Ride** (`src/components/three/Ride.tsx` + `ride-scene.ts`): a CatmullRom aurora rail, dotted sleepers, and a car per
  subject drawn on a canvas (`subjectPaths` from `SubjectIcon`).
  - Moved by drag, a sideways wheel, the subject buttons (roving focus, arrow keys) or a tap. Tapping the front car
    scrolls to its row.
  - Frames are drawn only while a car moves. Reduced motion jumps instead.
  - DESIGN.md now allows this second 3D hero.
  - The design used the Aurora DNA values (700 ms settle, ease-out, no autoplay). The genjutsu brainstorm and approval
    steps were not run.
- **Grade setting:** `/account` has a "My grade" picker for students (`GradePicker`, `updateGrade`), and the signup
  page now shares `gradeGroups()` in `catalog.ts`.
- **Checked:**
  - tsc, 183 tests, build.
  - Student view in ar and en, desktop and phone, through a locally minted session for the seeded test student on
    `127.0.0.1`. The owner's localhost session was not touched.
  - Ride buttons, keys and drag; no horizontal overflow; no console errors; admin and signed-out users get the public
    home.
- **Not checked:**
  - Saving a new grade (it would write to the shared database).
  - The bundle box: no active bundle rule exists yet; the unit test covers it.
  - Reduced motion in a real browser.
  - A real phone.

## 2026-11-02: Ziina only, bank transfer removed

- Owner: "we only accept Ziina payment", Stripe hidden until allowed, delete everything about bank transfer.
- Deleted: `lib/transfer.ts`, `lib/bank-email*.ts` (and its tests), `/api/webhooks/bank-email`, `/admin/transfers`,
  `checkout/transfer`, `ReceiptUpload`, `docs/payment-bridge.md`. Also the course-page transfer box, bank details and
  auto-approve in Admin settings, the transfers tab and tile, receipt upload and download, the receipt filter and
  badge on orders, the transfer count in the morning briefing, the strings, the `BANK_*` env vars.
- Public copy (FAQ, terms, privacy) and the support AI policy now say: card, Apple Pay or Google Pay through Ziina, in AED.
- Kept on purpose: the `BankEmail` table, `Order.receipt*` and `PlatformSetting.bank*` columns (migrations stay
  additive until 2027; all were empty), and the MANUAL gateway (free coupons, admin grants, mark-paid).
- Checked: tsc, 179 tests, build; course page, checkout (ar/en), admin home, settings and orders in the browser.
- **Open:** only AED can be paid. A SKU in another currency shows "payment not open"; today all 12 SKUs are AED.
  The terms page still lists seven currencies.

## 2026-11-02: AI operations, phase 1 (solo owner, no staff)

- Plan: `C:\Users\sw-os\.claude\plans\rebrand-to-a-magical-meteor.md` (owner, teacher, student and parent AI
  steps; recommended stack; phases 2–3 still open).
- `src/lib/ai.ts` `askJson()` is now the only Gemini call (plain fetch plus zod). `AI_MODEL` env overrides the
  model, and `AI_ENABLED=0` turns every AI feature off. `ai-grading.ts` uses it.
- **Bank transfers:** an alert that lands in NEEDS_REVIEW now notifies every ADMIN (`notifyAdmins` in
  `notify.ts`). Before this, nobody was told about the queue.
- **Support inbox:** contact-form messages are stored as `SupportTicket`. Gemini drafts a reply grounded in the
  policy text in `src/lib/support.ts`. The owner edits and sends it at `/admin/support`; nothing is sent
  automatically. There is a new tile on the admin home. The email copy to `CONTACT_EMAIL` still goes out.
  **Keep `POLICY` in `support.ts` in step with the FAQ and policy pages.**
- **Homework:** the AI mark suggestion now runs once on submit (`after()`, capped at 300 a day per course). The
  teacher button still works. A resubmission clears the old AI mark.
- **Cron (daily 05:00 UTC):** a morning briefing to admins with the last 24 h of sales and signups, plus what is
  waiting and what is overdue. The Sunday parent summary is now an AI-written note per child, from numbers and
  teacher feedback only; the model never sees the child's name. It falls back to the fixed sentence.
- FAQ: dropped the stale "Unit 1 is free" entry (both languages).
- **Open:**
  - Migration `20261105120000_support_tickets` is **not applied yet**. Until it is, `/admin`, `/admin/support`
    and the briefing fail on the missing table. Run `npx prisma migrate deploy` before deploying.
  - Live-session reminders use windows of an hour or less on a daily cron, so most never fire. This needs an
    hourly scheduler (Vercel Pro or an external one).
  - The generic `AiRun` log and `/admin/ai` queue were left out. Add them when there is a second kind of AI
    draft to approve.

## 2026-11-02: New home planet and dawn intro

- The constellation is replaced by a planet (`src/components/three/Planet.tsx`, scene in `planet-scene.ts`):
  continents as dots from Natural Earth 110m (public domain), packed into `land.ts` (15 KB, regenerate with a
  d3-geo script: land and the Egypt + GCC region masks on a 0.9° grid). Ocean and atmosphere shaders, a beam on
  each capital, arcs from Cairo and Abu Dhabi. Colours come from `--color-planet-*` and the aurora tokens.
- Intro is now 4.2 s: back-lit crescent, dawn sweeps across while the planet turns to the Gulf, capitals light,
  arcs draw; the copy rises at 3.2 s (`brand.css`, guard timer 4.4 s in `Intro.tsx`). Reduced motion: one still frame.
- Framing follows the window shape, and the planet turns by the off-axis angle so the Gulf faces the viewer.
- Checked: tsc, tests, build; ar/en desktop and ar phone in the browser pane. Not seen on a real phone yet.

## 2026-11-01: Free unit cancelled, no teacher marketing

- Owner decision: no free unit. Migration `20261104120000_cancel_free_units` set the 4 free units to paid (ids in
  the SQL comment, **applied to Neon**). The admin switch, the course-page "start the free unit" button, the free chip
  and the course-card badge are gone; `Unit.isFree` stays in the schema, always false.
- Home no longer markets to teachers (the teacher tile is removed). Teachers join only through a small
  "A teacher who wants to join? Contact us" line on `/signup`, which links to `/contact`.

## 2026-11-01: "Aurora" redesign and role gaps (branch `redesign-aurora`)

A second, competing design on its own branch, cut from `redesign-curriculum-metro` so the marketplace, teacher-control
and Ziina work come along. Metro stays untouched on its branch for comparison. Production is untouched until the owner
picks one.

**Design**
- Stripe/Apple style, measured DNA in `docs/brand/aurora-dna.json`, theses in `DESIGN.md` §0–1.
- `tokens.css` rewritten with the same token names, so every page restyled at once. New fonts: IBM Plex Sans Arabic + Readex Pro.
- `globals.css`: pill buttons (`.btn-glow`, `.btn-ghost`), `.card`, `.hover-lift`. `brand.css`: `.stage`, aurora,
  scroll reveal, intro rules.
- Home hero: three.js constellation (`src/components/three/Constellation.tsx`): swirl → "A+" → globe with capital pins.
  The intro guard (`src/components/brand/Intro.tsx`) plays it once per tab, any input skips, reduced motion gets a still.
- Home page rewritten: hero, countries, roles bento (student / parent / teacher), latest courses, how it works, final CTA.
  Only real counts from the database.
- Header is glass and sticky; footer, CountryTile, CourseCard, nav shells and the country stations restyled.

**Roles**
- **Parent pays for a child.** `Order.beneficiaryId` (additive migration `20261103120000_order_beneficiary`, **already
  applied to Neon**, which is shared by local, preview and live). A parent's checkout must pick a linked child
  (`ParentLink`); grants go to `learnerOf(order)` in `src/lib/access.ts`. The parent receives the receipt.
- Parent area: `ParentNav`; the child page now shows exam results and live attendance. Weekly parent email already ran
  from the Sunday cron, no change.
- Signup honours `?type=PARENT` (the "I'm a parent" buttons).
- Teacher: `/teacher/earnings` by month and course from the ledger, CSV export at `/teacher/earnings/export`, and a
  setup checklist on `/teacher` (photo and bio, course, price, publish), shown to INSTRUCTOR accounts until done.
- Admin overview: added linked tiles for transfers to review (manual orders + bank emails) and open requests.

**Checked:** `tsc`, 190 vitest tests, `next build`, and key routes in ar/en at mobile and desktop in the browser pane.
The pane cannot screenshot WebGL; the scene was checked by reading pixels.

**Open**
- The owner chooses Aurora or Metro after the preview. Then that branch goes to main and production on approval.
- Not yet walked as a real INSTRUCTOR or PARENT account in the browser (needs the owner's sign-in).
- Lighthouse on the home page with the 3D hero not measured yet.
- Preview: https://alsaadi-academy-git-redesign-aurora-elhashash-academy.vercel.app (Vercel login). Its env vars are
  scoped to Preview + branch `redesign-aurora`, copied from `.env.local` (Production values are Sensitive and
  unreadable): same Neon DB, Stripe test key, `APP_URL` = the preview URL. No `GEMINI_API_KEY` there yet.

## 2026-11-01: Curriculum Metro redesign, marketplace stage, teacher control (uncommitted)

All of the following is in the working tree, **not committed or deployed**. The owner approves push and deploy.

**Visual redesign ("Curriculum Metro")**
- Tokens are in `src/app/tokens.css` (`@theme static`, one line colour per country) and motion in `src/app/brand.css`.
- The design is described in `DESIGN.md`.
- New pieces:
  - `src/components/brand/Network.tsx`, the metro map and `LineBadge`.
  - `src/components/brand/Intro.tsx`, a 1.8 s intro on the home page only. It plays once per tab session and is
    skipped under reduced motion, so Windows "Animation effects" off means no intro.
  - `src/components/NewsBanner.tsx`, the latest 5 courses, discounts and offers, shown on public pages only via
    `src/components/MarketingOnly.tsx`.
- The brand mark comes from `src/app/brand-svg.ts`. The icons and share images were redrawn.
- **Country identity:** each country shows its landmark (`src/components/brand/Landmark.tsx`), its flag
  (`public/flags/*.svg`) and its line colour. This appears on the tiles (`src/components/CountryTile.tsx`), the
  country page header and the home country list.

**Marketplace browsing**
- The path is country, then grade, then subject (new page `src/app/[locale]/courses/c/[country]/[level]/[subject]/page.tsx`).
- The subject page lists every teacher's published course for that grade and subject.
- `src/components/CourseCard.tsx` shows the cover (the "picture headline"), the teacher, the session count, the
  price and a free-unit badge.

**Teacher control**
- Guards are in `src/lib/staff.ts`; actions are in `src/app/[locale]/admin/actions.ts`.
- A teacher (INSTRUCTOR) can:
  - create courses;
  - edit titles, headline, cover and units/lessons ("sessions");
  - set package prices, discounts and rentals;
  - publish.
  There is no admin approval step.
- **Teacher country:** a teacher's country is the country of any grade the owner granted them (`TeacherSlot`,
  through an invite or Admin → Teachers). Since this entry the teacher may open **any active grade of that country
  and any subject that grade teaches** (`assertSlot` checks `GradeSubject` and the country, then records the slot).
- The `/teacher` dashboard lists those choices grouped by grade, and the teacher menu has a "My courses" tab
  (`/teacher#courses`).
- Admin-only: reassigning a course's teacher, granting the first slot (which sets the country), site-wide
  promotions and coupons, orders, refunds and finance.

**Admin fixes**
- The grade filter in Admin → Courses & prices is grouped by country.
- The public teacher page (`src/app/[locale]/teachers/[id]/page.tsx`) shows:
  - initials when there is no photo;
  - the subjects the teacher teaches;
  - the bio in the other language when only one language is written;
  - full course cards.

**Open**
- Commit and deploy, which need the owner's approval.
- Set `ZIINA_API_KEY` and register the webhook, both owner actions in the Ziina and Vercel dashboards.
- The FAQ still describes the inactive monthly plan.
- Egypt Grade 12 test courses are priced in AED.
- Course share images render text in the default font.
- Session revocation for deleted or demoted users is deferred by the owner. Fix it when touching auth.
- Live benchmark findings (2026-11-01):
  - Typical page 0.59 s.
  - Slow pages: admin/teachers 1.7 s, dashboard 1.6 s, teacher 1.4 s.
  - The admin/catalog HTML is 468 KB.
  - 11 tap targets on the home page are under 44 px.
